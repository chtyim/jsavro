(function() {

    var Java = new JavaImporter(java.lang,
                                java.io,
                                java.math,
                                org.apache.avro.io,
                                org.apache.commons.codec.binary);

    var encodedBase64 = "";

    testCases(test,

        function setUp() {
            var byteOut = new Java.ByteArrayOutputStream();
            var encoder = new Java.BinaryEncoder(byteOut);

            encoder.writeDouble(Java.Double.POSITIVE_INFINITY);
            encoder.writeDouble(Java.Double.NEGATIVE_INFINITY);
            encoder.writeDouble(Java.Double.NaN);
            encoder.writeDouble(Java.Double.MAX_VALUE);
            encoder.writeDouble(Java.Double.MIN_VALUE);
            encoder.writeDouble(Java.Double.MIN_NORMAL);
            encoder.writeDouble(Java.Double.valueOf("0.0").doubleValue());
            encoder.writeDouble(Java.Double.valueOf("-0.0").doubleValue());
            encoder.writeDouble(Java.Double.valueOf("6547.3333333").doubleValue());
            encoder.writeDouble(Java.Double.valueOf("-0.000452").doubleValue());

            encoder.writeFloat(Java.Float.POSITIVE_INFINITY);
            encoder.writeFloat(Java.Float.NEGATIVE_INFINITY);
            encoder.writeFloat(Java.Float.NaN);
            encoder.writeFloat(Java.Float.MAX_VALUE);
            encoder.writeFloat(Java.Float.MIN_VALUE);
            encoder.writeFloat(Java.Float.MIN_NORMAL);
            encoder.writeFloat(Java.Float.valueOf("0.0").floatValue());
            encoder.writeFloat(Java.Float.valueOf("-0.0").floatValue());
            encoder.writeFloat(Java.Float.valueOf("1.0").floatValue());
            encoder.writeFloat(Java.Float.valueOf("0.25").floatValue());
            encoder.writeFloat(Java.Float.valueOf("-12.662").floatValue());

            encoder.writeBoolean(true);
            encoder.writeBoolean(false);

            encoder.writeInt(10);
            encoder.writeInt(-50);
            encoder.writeInt(234234);
            encoder.writeInt(-346456);
            encoder.writeInt(Java.Integer.MAX_VALUE - 1);
            encoder.writeInt(Java.Integer.MIN_VALUE + 1);

            encoder.writeLong(1);
            encoder.writeLong(-2);
            encoder.writeLong(Java.BigInteger.valueOf(Java.Integer.MAX_VALUE).add(Java.BigInteger.valueOf(1)).longValue());
            encoder.writeLong(Java.BigInteger.valueOf(Java.Integer.MIN_VALUE).subtract(Java.BigInteger.valueOf(1)).longValue());
            encoder.writeLong(Java.BigInteger.valueOf(Java.Long.MAX_VALUE).divide(Java.BigInteger.valueOf(4096)).longValue());
            encoder.writeLong(Java.BigInteger.valueOf(Java.Long.MIN_VALUE).divide(Java.BigInteger.valueOf(4096)).longValue());
            encoder.writeLong(Java.BigInteger.valueOf(Java.Long.MAX_VALUE).longValue());
            encoder.writeLong(Java.BigInteger.valueOf(Java.Long.MIN_VALUE).longValue());

            var bytes = Java.String("0123456789").getBytes("ASCII");
            encoder.writeFixed(bytes, 0, bytes.length);
            encoder.writeBytes((Java.String("Hello World!")).getBytes("ASCII"));
            encoder.writeString((new Java.StringBuilder("$")).appendCodePoint(0x20ac).appendCodePoint(0x2f81a).appendCodePoint(0xa2).toString());

            encoder.flush();
            byteOut.close();

            encodedBase64 = Java.Base64.encodeBase64String(byteOut.toByteArray());
        },

        function testDecoder() {
            // Varify the decoder
            var i;
            var fixed;
            var bytes;
            var str;
            var decoder = AVRO.Base64BinaryDecoder();

            decoder.feed(encodedBase64);

            assert.that(decoder.readDouble(), eq(Number.POSITIVE_INFINITY));
            assert.that(decoder.readDouble(), eq(Number.NEGATIVE_INFINITY));
            assert.that(isNaN(decoder.readDouble()), isTrue());
            assert.that(decoder.readDouble(), eq(Number.MAX_VALUE));
            assert.that(decoder.readDouble(), eq(Number.MIN_VALUE));
            assert.that(decoder.readDouble(), eqFloat(Java.Double.MIN_NORMAL, 1e-200));
            assert.that(decoder.readDouble(), eqFloat(0, 1e-200));
            assert.that(decoder.readDouble(), eqFloat(0, 1e-200));
            assert.that(decoder.readDouble(), eqFloat(Java.Double.parseDouble("6547.3333333"), 1e-200));
            assert.that(decoder.readDouble(), eqFloat(Java.Double.parseDouble("-0.000452"), 1e-200));

            assert.that(decoder.readFloat(), eq(Number.POSITIVE_INFINITY));
            assert.that(decoder.readFloat(), eq(Number.NEGATIVE_INFINITY));
            assert.that(isNaN(decoder.readFloat()), isTrue());
            assert.that(decoder.readFloat(), eqFloat(Java.Float.MAX_VALUE, 1e-200));
            assert.that(decoder.readFloat(), eqFloat(Java.Float.MIN_VALUE, 1e-200));
            assert.that(decoder.readFloat(), eqFloat(Java.Float.MIN_NORMAL, 1e-200));
            assert.that(decoder.readFloat(), eqFloat(0, 1e-200));
            assert.that(decoder.readFloat(), eqFloat(0, 1e-200));
            assert.that(decoder.readFloat(), eqFloat(Java.Float.parseFloat("1"), 1e-200));
            assert.that(decoder.readFloat(), eqFloat(Java.Float.parseFloat("0.25"), 1e-200));
            assert.that(decoder.readFloat(), eqFloat(Java.Float.parseFloat("-12.662"), 1e-200));

            assert.that(decoder.readBoolean(), isTrue());
            assert.that(decoder.readBoolean(), isFalse());

            assert.that(decoder.readInt(), eq(10));
            assert.that(decoder.readInt(), eq(-50));
            assert.that(decoder.readInt(), eq(234234));
            assert.that(decoder.readInt(), eq(-346456));
            assert.that(decoder.readInt(), eq(2147483646));
            assert.that(decoder.readInt(), eq(-2147483647));

            assert.that(decoder.readLong(), eq(1));
            assert.that(decoder.readLong(), eq(-2));
            assert.that(decoder.readLong(), eq(2147483648));
            assert.that(decoder.readLong(), eq(-2147483649));
            assert.that(decoder.readLong(), eq(2251799813685247));
            assert.that(decoder.readLong(), eq(-2251799813685248));
            // The max and min long get rounded off
            assert.that(decoder.readLong(), eq(Java.Long.MAX_VALUE));
            assert.that(decoder.readLong(), eq(Java.Long.MIN_VALUE));

            fixed = decoder.readFixed(10);
            assert.that(fixed.length, eq(10));
            for (i = 0; i < fixed.length; i++) {
                assert.that(fixed[i], eq(0x30 + i));
            }

            bytes = decoder.readBytes();
            str = "";
            for (i = 0; i < bytes.length; i++) {
                str += String.fromCharCode(bytes[i]);
            }
            assert.that(str, eq("Hello World!"));
            assert.that(decoder.readString(), eq("$\u20ac\ud87e\udc1a\u00a2"));

            // Not more bytes to read, should throw exception.
            shouldThrowException(function() { decoder.readBoolean(); });
        }
    );
}());