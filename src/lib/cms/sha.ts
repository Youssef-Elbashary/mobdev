/** The sha git (and GitHub) gives a file's content: sha1 of "blob <bytes>\0<content>". */
import { createHash } from 'node:crypto';

export function blobSha(content: string): string {
  const body = Buffer.from(content, 'utf8');
  return createHash('sha1').update(`blob ${body.length}\0`).update(body).digest('hex');
}
