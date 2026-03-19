export interface StorageProvider {
  /**
   * Upload a file to storage.
   * @returns The public URL of the uploaded file.
   */
  upload(key: string, body: Buffer, contentType: string): Promise<string>;

  /**
   * Delete a file from storage.
   */
  delete(key: string): Promise<void>;

  /**
   * Get the public URL for a storage key.
   */
  getUrl(key: string): string;

  /**
   * Check if the storage backend is properly configured and reachable.
   */
  isConfigured(): boolean;
}
