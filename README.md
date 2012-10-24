Javascript library for Avro
===========================

This is a pure javascript implemention for encoding/decoding avro data.

Limitations
-----------
Due to JS limitation, some functions are not fully supported
* Floating point precision cannot be strictly followed.
* long value will lose precision when larger than 52 bits.
* Four bytes UTF-8 characters in code point U+010000 to U+10FFFF are decoded as UTF-16BE surrogate pair. In JS, however, it doesn't know about surrogate, hence the pair will has string length of two instead of one.
