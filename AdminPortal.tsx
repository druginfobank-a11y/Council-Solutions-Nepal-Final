
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Ensures an external link has a valid protocol (https://) to prevent DNS/NXDOMAIN faults.
 */
export const ensureExternalLink = (url: string | undefined | null): string => {
  if (!url) return '';
  let clean = url.trim();
  if (!/^https?:\/\//i.test(clean)) {
    return `https://${clean}`;
  }
  return clean;
};

/**
 * Robust URL repair utility to fix malformed CDN assets.
 * CRITICAL: Transform Storage API URLs to Pull Zone URLs to avoid 403 Forbidden errors in iframes.
 */
export const sanitizeUrl = (url: string | undefined | null): string => {
  if (!url) return '';
  let repaired = url.trim();
  
  if (repaired.startsWith('data:')) return repaired;
  
  // Remove duplicate protocols
  repaired = repaired.replace(/^(https?:\/\/)+/g, 'https://');
  
  if (repaired.startsWith('//')) repaired = `https:${repaired}`;

  // Step 1: Handle Bunny Storage API endpoints (sg.storage.bunnycdn.com or storage.bunnycdn.com)
  if (repaired.includes('storage.bunnycdn.com')) {
    try {
      const urlObj = new URL(repaired);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      
      if (pathParts[0] === 'councilsolutionnepal') {
        pathParts.shift();
      }
      
      const cleanPath = pathParts.join('/');
      return `https://councilsolutionnepal.b-cdn.net/${cleanPath}`;
    } catch (e) {
      console.warn("URL Parse Failure in Sanitize Node");
    }
  }
  
  // Step 2: Handle relative paths or old domains
  if (!repaired.startsWith('http')) {
    const cleanPath = repaired.replace(/^\/|councilsolutionnepal\//g, '');
    return `https://councilsolutionnepal.b-cdn.net/${cleanPath}`;
  }

  if (repaired.includes('councilnode.np')) {
    repaired = repaired.replace(/councilnode\.np/g, 'councilsolutionnepal.b-cdn.net');
  }

  // Ensure Bunny CDN pathing is clean (no double zone name)
  if (repaired.includes('.b-cdn.net/councilsolutionnepal/')) {
    repaired = repaired.replace('.b-cdn.net/councilsolutionnepal/', '.b-cdn.net/');
  }

  return repaired;
};

export const getThumbnailUrl = (url: string | undefined | null, width: number = 400): string => {
  const base = sanitizeUrl(url);
  if (!base || base.startsWith('data:')) return base;
  return `${base}?width=${width}&quality=80&format=webp`;
};

export const getStorageConfig = async () => {
  try {
    const snap = await getDoc(doc(db, 'system', 'config'));
    if (snap.exists()) {
      const data = snap.data();
      const region = data.bunnyRegion || 'Singapore';
      return {
        hostname: region === 'Singapore' ? 'sg.storage.bunnycdn.com' : 'storage.bunnycdn.com',
        zoneName: data.bunnyZoneName || 'councilsolutionnepal',
        accessKey: data.bunnyPassword || 'ab8d08fa-a3cf-41f5-b46c26f788e3-407c-47a4',
        pullZone: sanitizeUrl(data.bunnyPullZoneUrl || 'councilsolutionnepal.b-cdn.net').replace(/\/$/, '')
      };
    }
  } catch (e) {
    console.error("Storage config unreachable, using defaults.");
  }
  
  return {
    hostname: 'sg.storage.bunnycdn.com',
    zoneName: 'councilsolutionnepal',
    accessKey: 'ab8d08fa-a3cf-41f5-b46c26f788e3-407c-47a4',
    pullZone: 'https://councilsolutionnepal.b-cdn.net'
  };
};

export const verifyBunnyConnection = async (configOverride?: any): Promise<{ success: boolean; message: string }> => {
  try {
    const config = configOverride || await getStorageConfig();
    const url = `https://${config.hostname}/${config.zoneName}/`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'AccessKey': config.accessKey },
    });

    if (response.status === 200) return { success: true, message: 'Node Pulse Active.' };
    if (response.status === 401) return { success: false, message: 'Authentication Failed (401).' };
    return { success: false, message: `Node Error: ${response.status}` };
  } catch (e) {
    return { success: false, message: 'Network Timeout: Node unreachable.' };
  }
};

export const uploadToBunny = (
  file: File, 
  path: string = 'library', 
  onProgress?: (percent: number) => void
): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    try {
      const config = await getStorageConfig();
      const sanitizedFileName = file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
      const fileName = `${Date.now()}-${sanitizedFileName}`;
      const cleanPath = path.replace(/^\/|\/$/g, '');
      const uploadUrl = `https://${config.hostname}/${config.zoneName}/${cleanPath}/${fileName}`;

      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('AccessKey', config.accessKey);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

      if (onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(sanitizeUrl(`${config.pullZone}/${cleanPath}/${fileName}`));
        } else {
          const msg = xhr.status === 401 ? 'Invalid Access Key' : `Server Status ${xhr.status}`;
          reject(new Error(`CDN Node Rejected: ${msg}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network Failure: Check connectivity or CORS permissions in Bunny Dashboard.'));
      xhr.send(file);
    } catch (e: any) {
      reject(new Error(`Storage Sync Fault: ${e.message}`));
    }
  });
};
