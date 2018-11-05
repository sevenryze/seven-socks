export interface IServerOptions {
  listenAddr: string;
  listenPort: number;
}

export class SocksServer {
  constructor(options: IServerOptions) {
    this.listenPort = options.listenPort;
    this.listenAddr = options.listenAddr;
  }

  private listenAddr: string;
  private listenPort: number;
}
