type WSCallback = (payload: any) => void;

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timer: ReturnType<typeof setTimeout>;
  action: string;
}

class VisionWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private isConnecting: boolean = false;
  private callbacks: Map<string, WSCallback[]> = new Map();
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestCounter: number = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 10000;

  constructor(url?: string) {
    if (url) {
      this.url = url;
    } else {
      // Always connect to the FastAPI backend on port 8000
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      this.url = `${wsProtocol}//localhost:8000/ws/vision`;
    }
    // Auto-connect on creation
    this.connect().catch(() => {
      console.warn("[WS] Initial connection failed, will retry...");
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect().catch(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
        this.scheduleReconnect();
      });
    }, this.reconnectDelay);
  }

  connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.isConnecting) {
      return new Promise((resolve) => {
        const interval = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });
    }

    this.isConnecting = true;
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectDelay = 1000; // Reset delay on successful connection
        console.log("[WS] Connected to backend:", this.url);
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const reqId = payload.requestId;

          // Resolve pending request by requestId if present
          if (reqId && this.pendingRequests.has(reqId)) {
            const pending = this.pendingRequests.get(reqId)!;
            this.pendingRequests.delete(reqId);
            clearTimeout(pending.timer);
            if (payload.error) {
              pending.reject(new Error(payload.error));
            } else {
              pending.resolve(payload);
            }
          }

          const type = payload.type;
          if (type && this.callbacks.has(type)) {
            const handlers = [...(this.callbacks.get(type) || [])];
            handlers.forEach((h) => {
              try {
                h(payload);
              } catch (e) {
                console.error("WS callback error:", e);
              }
            });
          }
        } catch (err) {
          console.error("WS Message Error:", err);
        }
      };

      this.ws.onerror = (err) => {
        this.isConnecting = false;
        reject(err);
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.ws = null;
        // Reject all pending requests on disconnect
        for (const [id, pending] of this.pendingRequests.entries()) {
          clearTimeout(pending.timer);
          pending.reject(new Error("WebSocket disconnected"));
        }
        this.pendingRequests.clear();
        console.warn("[WS] Connection closed, scheduling reconnect...");
        this.scheduleReconnect();
      };
    });
  }

  on(type: string, callback: WSCallback) {
    if (!this.callbacks.has(type)) {
      this.callbacks.set(type, []);
    }
    this.callbacks.get(type)!.push(callback);
  }

  off(type: string, callback: WSCallback) {
    if (!this.callbacks.has(type)) return;
    const handlers = this.callbacks.get(type)!;
    this.callbacks.set(
      type,
      handlers.filter((h) => h !== callback)
    );
  }

  async send(data: object) {
    await this.connect();
    this.ws?.send(JSON.stringify(data));
  }

  /**
   * Sends a request over WebSocket and awaits the corresponding response with a matching requestId.
   * Cleans up listeners and timers automatically.
   */
  async request<T = any>(
    action: string,
    payload: Record<string, any> = {},
    timeoutMs: number = 15000
  ): Promise<T> {
    await this.connect();
    const requestId = `req_${Date.now()}_${++this.requestCounter}`;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`WebSocket request '${action}' timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timer,
        action,
      });

      try {
        this.ws?.send(JSON.stringify({ ...payload, action, requestId }));
      } catch (err) {
        clearTimeout(timer);
        this.pendingRequests.delete(requestId);
        reject(err);
      }
    });
  }
}

export const wsClient = new VisionWebSocketClient();

