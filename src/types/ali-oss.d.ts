declare module 'ali-oss' {
  interface OSSOptions {
    region: string;
    accessKeyId: string;
    accessKeySecret: string;
    bucket: string;
  }

  interface PutResult {
    name: string;
    url: string;
    res: { status: number };
  }

  class OSS {
    constructor(options: OSSOptions);
    put(name: string, file: string | Buffer): Promise<PutResult>;
    delete(name: string): Promise<void>;
    signatureUrl(name: string, options?: { expires?: number }): string;
  }

  export = OSS;
}
