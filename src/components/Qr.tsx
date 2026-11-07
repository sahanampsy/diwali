import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function Qr({ value, size = 200 }: { value: string; size?: number }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(value, { margin: 1, width: size * 2, color: { dark: '#1a0b2e', light: '#fff4e0' } })
      .then(setSrc)
      .catch(() => setSrc(''));
  }, [value, size]);
  return src ? <img className="qr" src={src} width={size} height={size} alt={`QR code for ${value}`} /> : null;
}
