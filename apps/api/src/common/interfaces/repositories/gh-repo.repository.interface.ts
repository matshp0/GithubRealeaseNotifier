export interface GhRepo {
  id: string;
  fullName: string;
  lastSeenTag: string | null;
  etag: string | null;
}

export interface IGhRepoRepository {
  findByFullName(fullName: string): Promise<GhRepo | null>;
  create(data: {
    fullName: string;
    lastSeenTag: string | null;
    etag: string | null;
  }): Promise<GhRepo>;
}
