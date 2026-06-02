export function parseSSEEvent(rawEvent) {
  const event = {
    type: 'message',
    data: '',
  };

  for (const rawLine of rawEvent.split(/\r?\n/)) {
    if (!rawLine || rawLine.startsWith(':')) continue;

    const separatorIndex = rawLine.indexOf(':');
    const field = separatorIndex === -1 ? rawLine : rawLine.slice(0, separatorIndex);
    let value = separatorIndex === -1 ? '' : rawLine.slice(separatorIndex + 1);

    if (value.startsWith(' ')) value = value.slice(1);

    if (field === 'event') {
      event.type = value || 'message';
    } else if (field === 'data') {
      event.data += event.data ? `\n${value}` : value;
    }
  }

  return event.data ? event : null;
}

export function base64ToBytes(base64) {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);

  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  return bytes;
}
