
export type ISqlType =
    /**
     * BigInt, long, 8 bytes
     */
    "BigInt" |

    /**
     * Integer, 4 bytes
     */
    "Int" |

    /**
     * Floating Point number, 4 bytes only
     */

    "Float" |


    /**
     * Numeric with default (18,2) precision ans scale, you can change precision
     */
    "Decimal" |

    /**
     * Double, floating point number, 8 bytes
     */
    "Double" |
    /**
     * Date and Time, usually 8 bytes
     */
    "DateTime" |
    /**
     * Date and Time with TimeZone, 8+ bytes
     */
    "DateTimeOffset" |
    /**
     * Ascii character, single byte, do not use for unicode
     */
    "AsciiChar" |

    /**
     * Unicode character
     */

    "Char" |
    /**
     * Single bit
     */
    "Boolean" |
    
    /**
     * uuid
     */
    "UUID" |
    
    /**
     * text json
     */
    "JSON" |
    
    /**
     * Binary Json
     */
    "JSONB" | 
    
    /**
     * Byte Array - var binary
     */
    "ByteArray";
