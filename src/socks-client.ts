import { connect, Server, Socket } from "net";
import { Debug } from "./lib/debugger";
import { Encrytion } from "./lib/encrytion";
import { AuthenticationMethod, SocksCommand, Socksv5, SocksVersion } from "./lib/socks";

const debug = Debug(__filename);

export interface IClientOptions {
  listenAddress: string;
  listenPort: number;
  serverAddress: string;
  serverPort: number;
  cipherAlgorithm: string;
}

export class SocksClient {
  public start = () => {
    const clientServer = new Server(async userSclientSocket => {
      debug(`App client socket connected`);
      this.userSclientSocket = userSclientSocket;

      await this.handshake();
    });

    clientServer.on("error", err => {
      console.error(`Client server error: ${err}`);
    });

    clientServer.listen(this.listenPort, this.listenAddress, () => {
      console.log(`Client server listening on ${this.listenAddress}:${this.listenPort}...`);
    });
  };

  constructor(options: IClientOptions) {
    this.listenAddress = options.listenAddress;
    this.listenPort = options.listenPort;
    this.serverAddress = options.serverAddress;
    this.serverPort = options.serverPort;
    this.cipherAlgorithm = options.cipherAlgorithm;
  }

  private listenAddress: string;
  private listenPort: number;
  private serverAddress: string;
  private serverPort: number;
  private cipherAlgorithm: string;
  private password: string;

  private userSclientSocket!: Socket;
  private clientServerSocket: Socket;

  private handleUserSclientSocket = (socket: Socket) => {
    socket.on("data", data => {});
  };

  private handshake = async () => {
    debug(`Handshake stage start`);

    //TODO: Error process
    let dataFromApp = await read(this.userSclientSocket);
    if (!dataFromApp) {
      warn(`Get null buffer from the app-client socket`);
    }

    debug(`Client get data from app: ${dataFromApp}`);

    let methodCount = dataFromApp[1];
    let method = dataFromApp.slice(1, methodCount).includes(AuthenticationMethod.NoAuthenticationRequired, 1)
      ? AuthenticationMethod.NoAcceptableMethods
      : AuthenticationMethod.NoAcceptableMethods;

    try {
      await write(this.userSclientSocket, Buffer.from([SocksVersion.v5, method]));
    } catch (error) {
      error(`Client write to app error: ${error}`);
    }
  };

  private handleRequest = async () => {
    debug(`Handle app request start`);

    let requestFromApp = await read(this.userSclientSocket);

    debug(`Client get request from app: ${requestFromApp}`);

    let decodedRequest = Socksv5.decodeDetailRequest(requestFromApp);

    //TODO: Control flow between tcp and udp, maybe binding.
    if (decodedRequest.command === SocksCommand.Connect) {
      // TCP proxy
      this.clientServerSocket = connect(
        this.serverPort,
        this.serverAddress,
        async () => {
          debug(`Client <--> server connection established`);

          debug(`Begin to crypto the app request`);
          let encryptMeta = Encrytion.encrypt(requestFromApp, this.password);

          debug(`Begin to forward request to server`);
          await write(this.clientServerSocket, Buffer.concat([encryptMeta.iv, encryptMeta.encrypted]));

          debug(`Begin to get reply from server`);
          let serverResponse = await read(this.clientServerSocket);

          debug(`Begin to decrypt the reply`);
          let decryption = Encrytion.decrypt(serverResponse, this.password);

          debug(`Begin to response to app`);
          await write(this.userSclientSocket, decryption);

          debug(`Begin the duplex pipe`);
          this.userSclientSocket.pipe(Encrytion.cipher).pipe(this.clientServerSocket);
          this.clientServerSocket.pipe(Encrytion.decipher).pipe(this.userSclientSocket);
        }
      );

      this.clientServerSocket.on("error", error => {
        error(`Client server connection error: ${error}`);
      });
    } else {
    }
  };
}

async function processHandshake(socket: Socket, data: Buffer) {
  debug(`ProcessHandshake get buffer: ${data}`);

  let methodCount = data[1];
  let method = data.slice(1, methodCount).includes(AuthenticationMethod.NoAuthenticationRequired, 1)
    ? AuthenticationMethod.NoAcceptableMethods
    : AuthenticationMethod.NoAcceptableMethods;

  try {
    await write(socket, Buffer.from([SocksVersion.v5, method]));
  } catch (error) {}
}

async function read(socket: Socket): Promise<Buffer> {
  let buffer;

  return new Promise<Buffer>((resolve, reject) => {
    socket.on("data", chunk => {
      buffer = buffer || chunk;
      buffer = Buffer.concat([buffer, chunk]);
    });
    socket.on("end", () => {
      resolve(buffer);
    });
    socket.on("error", error => {
      reject(error);
    });
  });
}

async function write(socket: Socket, data: Buffer): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    socket.write(data, () => {
      resolve(true);
    });

    socket.on("error", error => {
      reject(error);
    });
  });
}
