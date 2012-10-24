(function() {

    var Java = new JavaImporter(java.lang,
                                java.io,
                                java.math,
                                org.apache.avro.io,
                                org.apache.commons.codec.binary);

    testCases(test,

        function setUp() {
        },

        function testEncoder() {
            var encoder = AVRO.Base64BinaryEncoder();
            encoder.writeInt(10);
            encoder.writeInt(130);
            encoder.writeInt(16385);
            encoder.writeInt(1048576 * 2 + 1);
            encoder.writeInt(Java.Integer.MAX_VALUE);

            encoder.writeInt(-10);
            encoder.writeInt(-130);
            encoder.writeInt(-16385);
            encoder.writeInt(-1048576 * 2 - 1);
            encoder.writeInt(Java.Integer.MIN_VALUE);

            encoder.writeLong(65538)
            encoder.writeLong(70871303804);

            var decoder = AVRO.Base64BinaryDecoder();
            decoder.feed(encoder.getEncoded(true));

            assert.that(decoder.readInt(), eq(10));
            assert.that(decoder.readInt(), eq(130));
            assert.that(decoder.readInt(), eq(16385));
            assert.that(decoder.readInt(), eq(1048576 * 2 + 1));
            assert.that(decoder.readInt(), eq(Java.Integer.MAX_VALUE));

            assert.that(decoder.readInt(), eq(-10));
            assert.that(decoder.readInt(), eq(-130));
            assert.that(decoder.readInt(), eq(-16385));
            assert.that(decoder.readInt(), eq(-1048576 * 2 - 1));
            assert.that(decoder.readInt(), eq(Java.Integer.MIN_VALUE));

            assert.that(decoder.readLong(), eq(65538));
            assert.that(decoder.readLong(), eq(70871303804));
        }
    );
}());