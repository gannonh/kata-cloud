export interface SpecComment {
  id: string;
  parentId: string | null;
  author: string;
  body: string;
  createdAt: string;
}

export interface SpecCommentThread {
  id: string;
  anchor: string;
  createdAt: string;
  updatedAt: string;
  comments: SpecComment[];
}

export type SpecTaskStatus =
  | "not_started"
  | "in_progress"
  | "waiting"
  | "discussion_needed"
  | "review_required"
  | "complete";

export interface SpecTaskRecord {
  id: string;
  title: string;
  description: string;
  content: string;
  status: SpecTaskStatus;
  sourceType: "spec_task_block";
  createdAt: string;
  updatedAt: string;
}

export interface SpecNoteDocument {
  content: string;
  updatedAt: string;
  threads: SpecCommentThread[];
  tasks?: SpecTaskRecord[];
}

export interface SpecCommentTreeNode extends SpecComment {
  children: SpecCommentTreeNode[];
}
