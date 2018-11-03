/**
 * Copyright by Sevenryze.
 */

// Import node.js libraries

// Import third-party libraries
import * as ip from "ip";

// Import own libraries

/**********************************************************************************************************************/
export const enum SocksVersion {
    v4 = 0x04,
    v5 = 0x05
}

export const enum SocksCommand {
    Connect = 0x01,
    Bind = 0x02,
    UDPAssociate = 0x03
}

export const enum SocksReserved {
    Reserved = 0x00
}

export const enum AuthenticationMethod {
    NoAuthenticationRequired = 0x00,
    GSSAPI = 0x01,
    UsernamePassword = 0x02,
    NoAcceptableMethods = 0xFF
}

export const enum SocksAddressType {
    IPv4 = 0x01,
    DomainName = 0x03,
    IPv6 = 0x04
}

export class Socksv5 {
    public static decodeNegotiationRequest() {

    }

    public static decodeDetailRequest(requestData: Buffer): {
        version: SocksVersion;
        command: SocksCommand;
        reserved: SocksReserved;
        addressType: SocksAddressType;
        address: string;
        port: number;
        totalLength: number;
        rawRequest: Buffer;
    } {
        if (requestData.length < 6) {
            throw Error(`Request data is too short, get ${requestData}`);
        }

        let reserved = requestData[2];
        if (reserved !== 0x00) {
            throw Error(`Request data corrupted, get ${requestData}`);
        }

        let version = requestData[0];
        let command = requestData[1];
        let addressType = requestData[3];
        let addressLength;
        let address;

        switch (addressType) {
            case SocksAddressType.IPv4:
                addressLength = 4;
                address = ip.toString(requestData.slice(4, 4 + addressLength));
                break;

            case SocksAddressType.DomainName:
                addressLength = requestData[4];
                address = requestData.toString("utf8", 5, 5 + addressLength);
                break;

            case SocksAddressType.IPv6:
                addressLength = 16;
                address = ip.toString(requestData.slice(4, 4 + addressLength));
                break;

            default:
                throw Error(`Request address type not acceptable, get ${addressType}`)
        }

        let requestLength = 4 + (addressType === SocksAddressType.DomainName ? 1 : 0) + addressLength + 2;
        let port = requestData.readUInt16BE(requestLength - 2);

        return {
            version: version,
            command: command,
            reserved: reserved,
            addressType: addressType,
            address: address,
            port: port,
            totalLength: requestLength,
            rawRequest: requestData
        }
    }

}