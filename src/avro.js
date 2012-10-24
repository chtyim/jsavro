var AVRO = {};

(function(NS) {
    var strictMode = false;

    // Private namespace for Base64 related objects
    var Base64 = (function() {
        var base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        var decodeLookup = {};
        var i = 0;

        for (i = 0; i < 64; i++) {
            decodeLookup[base64Chars.charAt(i)] = i;
        }

        return {
            ByteReader : function() {
                var buffer = [];
                var srcIdx = 0;
                var source = "";

                // Private method of Base64ByteReader
                var fillBuffer = function() {
                    // decode 3 bytes using 4 bytes from source
                    var i;
                    var enc;
                    var code;
                    var len = source.length;

                    for (i = 0; srcIdx < len && i < 4; srcIdx++, i++) {
                        enc = source.charAt(srcIdx);
                        if (enc === '=') {
                            buffer.pop();
                            break;
                        }
                        // Skip any unknown character
                        if (decodeLookup.hasOwnProperty(enc)) {
                            code = decodeLookup[enc];

                            switch (i) {
                                case 0:
                                    buffer[0] = code << 2;
                                    break;
                                case 1:
                                    buffer[0] = buffer[0] | (code >> 4 & 0x03);
                                    buffer[1] = (code & 0x0F) << 4;
                                    break;
                                case 2:
                                    buffer[1] = buffer[1] | (code >> 2 & 0x0F);
                                    buffer[2] = (code & 0x03) << 6;
                                    break;
                                case 3:
                                    buffer[2] = buffer[2] | (code & 0x003F);
                                    break;
                            }
                        } else {
                            i--;
                        }
                    }
                };

                // Public interface supported by Base64ByteReader
                return {

                    // Feed in base64 encode string
                    update : function(base64Str) {
                        source += base64Str;
                    },

                    // Return the next byte as integer
                    readByte : function() {
                        if (buffer.length <= 0) {
                            fillBuffer();
                            if (buffer.length <= 0) {
                                return -1;
                            }
                        }

                        return buffer.shift();
                    }
                };
            },

            ByteWriter : function() {
                var buffer = [];
                var output = "";

                var encodeBuffer = function() {
                    var i;
                    var code;

                    for (i = 0; i < buffer.length; i++) {
                        switch (i) {
                            case 0:
                                output += base64Chars.charAt((buffer[0] >> 2) & 0x3F);
                                code = (buffer[0] & 0x03) << 4;
                                break;
                            case 1:
                                output += base64Chars.charAt(code | ((buffer[1] & 0xF0) >> 4));
                                code = (buffer[1] & 0x0F) << 2;
                                break;
                            case 2:
                                output += base64Chars.charAt(code | ((buffer[2] & 0xC0) >> 6));
                                output += base64Chars.charAt(buffer[2] & 0x3F);
                                break;
                        }
                    }
                    if (buffer.length !== 3) {
                        output += base64Chars.charAt(code);
                        for (i = 3; i > buffer.length; i--) {
                            output += "=";
                        }
                    }

                    buffer = [];
                };

                return {
                    writeByte : function(b) {
                        buffer.push(b);
                        if (buffer.length === 3) {
                            encodeBuffer();
                        }
                    },

                    getEncoded : function(last) {
                        if (last && buffer.length !== 0) {
                            encodeBuffer();
                        }
                        var res = output;
                        output = "";
                        return res;
                    }
                };
            }
        };
    }());

    // Private namespace for Utf8 methods
    var Utf8 = (function() {
        return {
            // Encodes UCS2 into UTF8 and writes to writer
            encode : function(str) {
                var len = str.length;
                var result = [];
                var code;
                var i;
                for (i = 0; i < len; i++) {
                    code = str.charCodeAt(i);
                    if (code <= 0x7f) {
                        result.push(code);
                    } else if (code <= 0x7ff) {                         // 2 bytes
                        result.push(0xc0 | (code >>> 6 & 0x1f),
                                    0x80 | (code & 0x3f));
                    } else if (code <= 0xd700 || code >= 0xe000) {      // 3 bytes
                        result.push(0xe0 | (code >>> 12 & 0x0f),
                                    0x80 | (code >>> 6 & 0x3f),
                                    0x80 | (code & 0x3f));
                    } else {                                            // 4 bytes, surrogate pair
                        code = (((code - 0xd800) << 10) | (str.charCodeAt(++i) - 0xdc00)) + 0x10000;
                        result.push(0xf0 | (code >>> 18 & 0x07),
                                    0x80 | (code >>> 12 & 0x3f),
                                    0x80 | (code >>> 6 & 0x3f),
                                    0x80 | (code & 0x3f));
                    }
                }
                return result;
            },

            // Decodes UTF8 into UCS2
            // Returns a string
            decode : function(bytes) {
                var len = bytes.length;
                var result = "";
                var code;
                var i;
                for (i = 0; i < len; i++) {
                    if (bytes[i] <= 0x7f) {
                        result += String.fromCharCode(bytes[i]);
                    } else if (bytes[i] >= 0xc0) {                                   // Mutlibytes
                        if (bytes[i] < 0xe0) {                                       // 2 bytes
                            code = ((bytes[i++] & 0x1f) << 6) |
                                    (bytes[i] & 0x3f);
                        } else if (bytes[i] < 0xf0) {                                // 3 bytes
                            code = ((bytes[i++] & 0x0f) << 12) |
                                   ((bytes[i++] & 0x3f) << 6)  |
                                    (bytes[i] & 0x3f);
                        } else {                                                     // 4 bytes
                            // turned into two character in JS as surrogate pair
                            code = (((bytes[i++] & 0x07) << 18) |
                                    ((bytes[i++] & 0x3f) << 12) |
                                    ((bytes[i++] & 0x3f) << 6) |
                                     (bytes[i] & 0x3f)) - 0x10000;
                            // High surrogate
                            result += String.fromCharCode((code >>> 10 & 0x3ff) + 0xd800);
                            code = (code & 0x3ff) + 0xdc00;
                        }
                        result += String.fromCharCode(code);
                    } // Otherwise it's an invalid UTF-8, skipped.
                }
                return result;
            }
        };
    }());

    // Common private methods
    var typeOf = function (value) {
        var s = typeof value;
        if (s === 'object') {
            if (value) {
                if (value instanceof Array) {
                    s = 'array';
                }
            } else {
                s = 'null';
            }
        }
        return s;
    };

    var ucFirst = function(str) {
        if (str.length <= 1) {
            return str.toUpperCase();
        }
        return str.substring(0, 1).toUpperCase() + str.substring(1);
    };


    NS.setStrictMode = function(strict) {
        strictMode = strict;
    };

    // Create a Avro binary encoder where the binary data is base64 encoded
    NS.Base64BinaryEncoder = function() {
        var writer = Base64.ByteWriter();

        var writeVarInt = function(n) {
            if ((n & ~0x7f) !== 0) {
                writer.writeByte(n & 0xff | 0x80);
                n >>>= 7;
                while (n > 0x7f) {
                    writer.writeByte(n & 0xff | 0x80);
                    n >>>= 7;
                }
            }
            writer.writeByte(n);
        };

        return {
            getEncoded : function(last) {
                return writer.getEncoded(last);
            },
            writeNull : function() {
                // Nothing need to write
            },
            writeBoolean : function(value) {
                writer.writeByte(value ? 1 : 0);
            },
            writeInt : function(value) {
                var n = (value << 1) ^ (value >> 31);
                writeVarInt(n);
            },
            writeLong : function(value) {
                var sign = value > 0 ? 0 : 0xffffffff;
                var low = (value << 1) ^ sign;
                var high = Math.floor(value / 0x80000000) ^ sign;
                var i;

                if (high === 0) {
                    writeVarInt(low);
                    return;
                }

                // Write the low bits
                for (i = 0; i < 4; i++) {
                    writer.writeByte(low & 0xff | 0x80);
                    low >>>= 7;
                }

                writer.writeByte(low | ((high & 0x07) << 4) | 0x80);

                high >>>= 3;
                while (high > 0x7f) {
                    writer.writeByte(high & 0xff | 0x80);
                    high >>>= 7;
                }
                if (high !== 0) {
                    writer.writeByte(high);
                }
            },
            writeFloat : function(value) {
            // To Be Implemented
            },
            writeDouble : function(value) {
            // To Be Implemented
            },
            writeFixed : function(bytes, start, len) {
                var i;
                var end = start + len;
                for (i = start; i < end; i++) {
                    writer.writeByte(bytes[i]);
                }
            },
            writeBytes : function(bytes, start, len) {
                this.writeLong(len);
                this.writeFixed(bytes, start, len);
            },
            writeString : function(str) {
                this.writeBytes(Utf8.encode(str));
            },
            writeEnum : function(e) {
                this.writeInt(e);
            },
            writeIndex : function(idx) {
                this.writeInt(idx);
            },
            writeArrayStart : function() {
            // To Be Implemented
            },
            writeArrayEnd : function() {
            // To Be Implemented
            },
            startItem : function() {
            // To Be Implemented
            },
            setItemCount : function() {
            // To Be Implemented
            },
            writeMapStart : function() {
            // To Be Implemented
            },
            writeMapEnd : function() {
            // To Be Implemented
            }
        };
    };

    // Create a Avro binary decoder where the binary data is base64 encoded
    NS.Base64BinaryDecoder = function() {
        // A reader inherited from Base64 reader
        var reader = (function() {
            var base = Base64.ByteReader();
            var func = function() {};
            func.prototype = base;
            var obj = new func();

            // Throw exception when there are no more byte to read
            obj.readByte = function() {
                var b = base.readByte();
                if (b === -1) {
                    throw "Insufficient input byte for decode.";
                }
                return b;
            };

            // Reads 32 bits little-endian value
            obj.read32le = function() {
                var b;
                var v = 0;
                var i;
                for (i = 0; i < 32; i += 8) {
                    b = this.readByte();
                    v |= (b << i);
                }
                return v;
            };

            return obj;
        }());

        var toPaddedHex = function(n) {
            var hex = "";
            var b;
            var i;
            for (i = 0; i < 32; i += 8) {
                b = ((n >>> (i)) & 0x0ff).toString(16);
                hex = (b.length === 1 ? "0" + b : b) + hex;
            }

            return hex;
        };

        // Reads count for array and map
        var readCount = function(decoder) {
            var count = decoder.readLong();
            if (count < 0) {
                decoder.readLong();
                count = -count;
            }
            return count;
        };

        return {
            feed : function(base64Str) {
                reader.update(base64Str);
            },
            readNull : function() {
                // No bytes consumed
                return null;
            },
            readBoolean : function() {
                return reader.readByte() === 1 ? true : false;
            },
            readInt : function() {
                var i;
                var b = reader.readByte();
                var n = b & 0x7f;

                for (i = 7; i <= 28 && b > 0x7f; i += 7) {
                    b = reader.readByte();
                    n |= (b & 0x7f) << i;
                }

                if (b > 0x7f) {
                    throw "Invalid int encoding.";
                }

                return (n >>> 1) ^ -(n & 1);
            },

            readLong : function() {
                var i;
                var b = reader.readByte();
                var sign = ((b & 0x01) === 0) ? 1 : -1;
                var n = b & 0x7f;
                var low;

                for (i = 7; i <= 28 && b > 0x7f; i += 7) {
                    b = reader.readByte();
                    n |= (b & 0x7f) << i;
                }

                // Encoded value is within 32 bit range
                if (i <= 28 || b <= 0x0f) {
                    return (n >>> 1) ^ -(n & 1);
                }

                // More than 32 bits
                low = n >>> 1;
                n = (b >> 4) & 0x07;
                for (i = 3; i < 32 && b > 0x7f; i += 7) {
                    b = reader.readByte();
                    n |= (b & 0x7f) << i;
                }

                if (b > 0x7f) {
                    throw "Invalid long encoding";
                }

                low |= (n & 0x01) << 31;
                n >>>= 1;

                if (strictMode) {
                    return [low, n];
                }

                /*
                 * Long with value > 52 bits cannot be resolved precisely due to
                 * JS use double floating point as the only number
                 * representation.
                 */
                // Two's complement'
                b = ("0x" + toPaddedHex(n) + toPaddedHex(low)) * sign;
                if (sign < 0) {
                    b--;
                }
                return b;
            },

            readFloat : function() {
                var value = reader.read32le();

                if (strictMode) {    // In strictMode, return the 32 bit
                    // float
                    return value;
                }

                // Not able to get the floating point back precisely due to
                // noise introduced in JS floating arithmetic
                var sign = ((value >> 31) << 1) + 1;
                var expo = (value & 0x7f800000) >> 23;
                var mant = value & 0x007fffff;

                if (expo === 0) {
                    if (mant === 0) {
                        return 0;
                    }
                    expo = -126;
                } else {
                    if (expo === 0xff) {
                        return mant === 0 ? (sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY) : Number.NaN;
                    }
                    expo -= 127;
                    mant |= 0x00800000;
                }

                return sign * mant * Math.pow(2, expo - 23);
            },
            readDouble : function() {
                var low = reader.read32le();
                var high = reader.read32le();

                if (strictMode) {
                    return [low, high];
                }

                var sign = ((high >> 31) << 1) + 1;
                var expo = (high & 0x7ff00000) >> 20;
                var mantHigh = high & 0x000fffff;
                var mant = 0;

                if (expo === 0) {
                    if (low === 0 && mantHigh === 0) {
                        return 0;
                    }
                    if (low === 1 && mantHigh === 0) {
                        return Number.MIN_VALUE;
                    }
                    expo = -1022;
                } else {
                    if (expo === 0x7ff) {
                        if (low === 0 && mantHigh === 0) {
                            return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
                        } else {
                            return Number.NaN;
                        }
                    }
                    if ((high ^ 0x7fefffff) === 0 && (low ^ 0xffffffff) === 0) {
                        return Number.MAX_VALUE;
                    }
                    expo -= 1023;
                    mant = 1;
                }

                mant += (low + (high & 0x000fffff) * Math.pow(2, 32)) * Math.pow(2, -52);
                return sign * mant * Math.pow(2, expo);
            },
            readFixed : function(len) {
                var result = [];
                var i;
                for (i = 0; i < len; i++) {
                    result.push(reader.readByte());
                }
                return result;
            },
            readBytes : function() {
                return this.readFixed(this.readLong());
            },
            readString : function() {
                return Utf8.decode(this.readBytes());
            },
            readEnum : function() {
                return this.readInt();
            },
            readIndex : function() {
                return this.readInt();
            },
            readArrayStart : function() {
                return readCount(this);
            },
            arrayNext : function() {
                return readCount(this);
            },
            readMapStart : function() {
                return readCount(this);
            },
            mapNext : function() {
                return readCount(this);
            }
        };
    };

    // Create a reader that decode according to the provided schema
    NS.DatumReader = function(schema, decoder) {

        var readDatum = function(schema) {
            var type;
            var i;
            var result;

            switch (typeOf(schema)) {
                case "object":
                    type = schema.type;
                break;
                case "string":
                    type = schema;
                break;
                case "array":
                    type = "union";
                break;
                default:
                    throw "Invalid schema type.";
            }

            switch (type) {
                // Primitive types
                case "null":
                case "boolean":
                case "int":
                case "long":
                case "float":
                case "double":
                case "bytes":
                case "string":
                    return decoder["read" + ucFirst(type)].apply(decoder);

                // Complex types
                case "record":
                    result = {};
                    for (i = 0; i < schema.fields.length; i++) {
                        result[schema.fields[i].name] = readDatum(schema.fields[i].type);
                    }
                    return result;

                case "enum":
                    return schema.symbols[decoder.readEnum()];

                case "array":
                    result = [];
                    i = decoder.readArrayStart();
                    while (i !== 0) {
                        while (i-- > 0) {
                            result.push(readDatum(schema.items));
                        }
                        i = decoder.arrayNext();
                    }
                    return result;

                case "map":
                    result = {};
                    i = decoder.readMapStart();
                    while (i !== 0) {
                        while (i-- > 0) {
                            result[readDatum("string")] = readDatum(schema.values);
                        }
                        i = decoder.mapNext();
                    }
                    return result;
                case "union":
                    return readDatum(schema[decoder.readIndex()]);

                default:
                    throw "Unsupported schema type " + type;
            }
        };

        return {
            read : function() {
                return readDatum(schema);
            }
        };
    };
}(AVRO));