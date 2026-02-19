export { SpecNotePanel } from "./spec-note-panel.js";
export {
  SPEC_NOTE_STORAGE_KEY,
  addCommentReply,
  addCommentThread,
  buildCommentTree,
  createDefaultSpecNote,
  loadSpecNote,
  saveSpecNote
} from "./store.js";
export type {
  SpecComment,
  SpecCommentThread,
  SpecCommentTreeNode,
  SpecNoteDocument,
  SpecTaskRecord,
  SpecTaskStatus
} from "./types.js";
