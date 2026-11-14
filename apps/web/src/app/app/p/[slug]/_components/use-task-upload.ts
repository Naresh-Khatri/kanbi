"use client";

import { useCallback } from "react";

import { fileUrl } from "@/lib/file-url";
import { api } from "@/trpc/react";

/** presign -> PUT to R2 -> register; server reads size/type from the object. */
export function useTaskUpload(boardId: string) {
  const { mutateAsync: createUploadUrl } =
    api.attachment.createUploadUrl.useMutation();
  const { mutateAsync: register } = api.attachment.create.useMutation();

  return useCallback(
    async (taskId: string, file: File, opts?: { inline?: boolean }) => {
      const mime = file.type || "application/octet-stream";
      const { key, uploadUrl } = await createUploadUrl({
        boardId,
        taskId,
        filename: file.name,
        mime,
        sizeBytes: file.size,
      });
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": mime },
        body: file,
      });
      if (!put.ok) throw new Error(`Upload failed: ${file.name}`);
      return register({
        boardId,
        taskId,
        key,
        filename: file.name,
        inline: opts?.inline,
      });
    },
    [boardId, createUploadUrl, register],
  );
}

/** For rich-text editors: upload as an inline image and return its stored url. */
export function useInlineImageUpload(boardId: string, taskId: string) {
  const upload = useTaskUpload(boardId);
  return useCallback(
    async (file: File) =>
      fileUrl((await upload(taskId, file, { inline: true })).id),
    [taskId, upload],
  );
}
