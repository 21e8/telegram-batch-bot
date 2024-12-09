export class MockResponse implements Response {
  readonly headers: Headers;
  readonly ok: boolean;
  readonly redirected: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly type:
    | 'basic'
    | 'cors'
    | 'default'
    | 'error'
    | 'opaque'
    | 'opaqueredirect';
  readonly url: string;
  readonly body: ReadableStream | null;
  readonly bodyUsed: boolean;

  constructor(private data: any = {}) {
    this.headers = new Headers();
    this.ok = data.ok ?? true;
    this.redirected = false;
    this.status = (data.error_code || data.status) ?? 200;
    this.statusText = data.statusText ?? 'OK';
    this.type = 'basic';
    this.url = data.url ?? '';
    this.body = data.body ?? null;
    this.bodyUsed = false;
  }

  json() {
    return Promise.resolve(this.data);
  }
  text() {
    return Promise.resolve('');
  }
  blob() {
    return Promise.resolve(new Blob([]));
  }
  arrayBuffer() {
    return Promise.resolve(new ArrayBuffer(0));
  }
  formData() {
    return Promise.resolve(new FormData());
  }
  clone(): Response {
    return new MockResponse(this.data);
  }
}