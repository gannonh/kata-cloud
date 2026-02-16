export type SpaceMetadata = {
  id: string;
  prompt: string;
  name: string;
  path: string;
  repo?: string;
  description?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateSpaceInput = {
  prompt: string;
  name: string;
  path: string;
  repo?: string;
  description?: string;
  tags?: string[];
};
