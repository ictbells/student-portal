import { useEffect, useState, type ReactNode } from 'react';
import api from '../api';

type Props = {
  applicationId?: number | null;
  src?: string | null;
  alt?: string;
  className?: string;
  placeholder?: ReactNode;
};

async function blobFrom(path: string): Promise<string> {
  const { data, headers } = await api.get(path, { responseType: 'blob' });
  const type = String(headers['content-type'] || data?.type || '');
  if (!data || data.size < 32 || type.includes('json') || type.includes('text/html')) {
    throw new Error('not an image');
  }
  if (type && !type.startsWith('image/') && type !== 'application/octet-stream') {
    throw new Error('not an image');
  }
  return URL.createObjectURL(data);
}

/**
 * Loads the applicant/student passport via authenticated API routes so the
 * photo displays without a public /storage symlink.
 */
export function PassportPhoto({
  applicationId,
  src,
  alt = 'Passport photograph',
  className,
  placeholder,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    const setSafe = (next: string | null) => {
      if (!cancelled) setUrl(next);
    };

    (async () => {
      setSafe(null);
      const endpoints = applicationId
        ? [`/api/applications/${applicationId}/passport`, '/api/me/passport']
        : ['/api/me/passport'];
      for (const endpoint of endpoints) {
        try {
          const next = await blobFrom(endpoint);
          if (cancelled) {
            URL.revokeObjectURL(next);
            return;
          }
          objectUrl = next;
          setSafe(next);
          return;
        } catch {
          // try the next source
        }
      }
      setSafe(src || null);
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [applicationId, src]);

  if (url) {
    return <img src={url} alt={alt} className={className} />;
  }

  return <>{placeholder ?? null}</>;
}
