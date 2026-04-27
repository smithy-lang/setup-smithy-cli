$version: "2"

namespace com.example

use smithy.protocols#rpcv2Cbor

/// A simple test service for integration testing the setup action.
@rpcv2Cbor
service TestService {
    version: "2020-07-02"
    operations: [Echo]
}

@idempotent
operation Echo {
    input := {
        message: String
    }
    output := {
        message: String
    }
}
