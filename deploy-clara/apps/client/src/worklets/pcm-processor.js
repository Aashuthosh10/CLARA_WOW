class PCMProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this._chunkSize = options?.processorOptions?.chunkSize ?? 4096;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) {
      return true;
    }

    const channelData = input[0];
    if (channelData && channelData.length) {
      // Clone the buffer to avoid transferring the shared memory reference
      const cloned = channelData.slice(0, this._chunkSize);
      this.port.postMessage(cloned, [cloned.buffer]);
    }

    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);

