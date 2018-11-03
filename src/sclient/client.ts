/**
 * Copyright by Sevenryze.
 */

// Import node.js libraries
import {Server, Socket, connect} from "net";

// Import third-party libraries
import * as log from "winston";

// Import own libraries
import {AuthenticationMethod, SocksCommand, Socksv5, SocksVersion} from "../lib/socks";
import {Encrytion} from "../lib/encrytion";


/**********************************************************************************************************************/


export interface Options {
    listenAddress: string;
    listenPort: number;
    serverAddress: string;
    serverPort: number;
    cipherAlgorithm: string;
}

export class Client {
    private listenAddress: string;
    private listenPort: number;
    private serverAddress: string;
    private serverPort: number;
    private cipherAlgorithm: string;
    private password: string;

    private appClientSocket: Socket;
    private clientServerSocket: Socket;


    constructor(options: Options) {
        this.listenAddress = options.listenAddress;
        this.listenPort = options.listenPort;
    }

    public start = () => {
        let clientServer = new Server(async (appClientSocket) => {
            log.debug(`App client socket connected`);
            this.appClientSocket = appClientSocket;

            await this.handshake();

        });

        clientServer.on("error", (err) => {
            log.error(`Client server error: ${err}`);
        });

        clientServer.listen(this.listenPort, this.listenAddress, () => {
            log.info(`Client server listening on ${this.listenAddress}:${this.listenPort}`)
        });
    };

    private handshake = async () => {
        log.debug(`Handshake stage start`);

        //TODO: Error process
        let dataFromApp = await read(this.appClientSocket);
        if (!dataFromApp) {
            log.warn(`Get null buffer from the app-client socket`);
        }

        log.debug(`Client get data from app: ${dataFromApp}`);

        let methodCount = dataFromApp[1];
        let method = dataFromApp.slice(1, methodCount).includes(AuthenticationMethod.NoAuthenticationRequired, 1) ?
            AuthenticationMethod.NoAcceptableMethods : AuthenticationMethod.NoAcceptableMethods;

        try {
            await write(this.appClientSocket, Buffer.from([SocksVersion.v5, method]))
        } catch (error) {
            error(`Client write to app error: ${error}`);
        }
    };

    private handleRequest = async () => {
        log.debug(`Handle app request start`);

        let requestFromApp = await read(this.appClientSocket);

        log.debug(`Client get request from app: ${requestFromApp}`);

        let decodedRequest = Socksv5.decodeDetailRequest(requestFromApp);

        //TODO: Control flow between tcp and udp, maybe binding.
        if (decodedRequest.command === SocksCommand.Connect) {
            // TCP proxy
            this.clientServerSocket = connect(this.serverPort, this.serverAddress, async () => {
                log.debug(`Client <--> server connection established`);

                log.debug(`Begin to crypto the app request`);
                let encryptMeta = Encrytion.encrypt(requestFromApp, this.password);

                log.debug(`Begin to forward request to server`);
                await write(this.clientServerSocket, Buffer.concat([encryptMeta.iv, encryptMeta.encrypted]));

                log.debug(`Begin to get reply from server`);
                let serverResponse = await read(this.clientServerSocket);

                log.debug(`Begin to decrypt the reply`);
                let decryption = Encrytion.decrypt(serverResponse, this.password);

                log.debug(`Begin to response to app`);
                await write(this.appClientSocket, decryption);

                log.debug(`Begin the duplex pipe`);
                this.appClientSocket.pipe(Encrytion.cipher).pipe(this.clientServerSocket);
                this.clientServerSocket.pipe(Encrytion.decipher).pipe(this.appClientSocket);
            });

            this.clientServerSocket.on("error", (error) => {
                log.error(`Client server connection error: ${error}`);
            });
        } else {

        }

    };

}


async function processHandshake(socket: Socket, data: Buffer) {
    log.debug(`ProcessHandshake get buffer: ${data}`);

    let methodCount = data[1];
    let method = data.slice(1, methodCount).includes(AuthenticationMethod.NoAuthenticationRequired, 1) ?
        AuthenticationMethod.NoAcceptableMethods : AuthenticationMethod.NoAcceptableMethods;

    try {
        await write(socket, Buffer.from([SocksVersion.v5, method]))
    } catch (error) {

    }
}


async function read(socket: Socket): Promise<Buffer> {
    let buffer;

    return new Promise<Buffer>((resolve, reject) => {
        socket.on("data", (chunk) => {
            buffer = buffer || chunk;
            buffer = Buffer.concat([buffer, chunk]);
        });
        socket.on("end", () => {
            resolve(buffer);
        });
        socket.on("error", (error) => {
            reject(error);
        });
    });
}

async function write(socket: Socket, data: Buffer): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        socket.write(data, () => {
            resolve(true);
        });

        socket.on("error", (error) => {
            reject(error);
        });
    });
}