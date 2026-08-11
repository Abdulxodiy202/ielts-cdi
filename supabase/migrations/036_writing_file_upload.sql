-- 036_writing_file_upload.sql
--
-- Writing section is moving from a React form (task1 image + task1/task2
-- text prompts + client-side textareas) to the same HTML-file-in-iframe
-- pattern Reading and Listening already use. Admin uploads a single HTML
-- (or ZIP-packaged HTML bundle), the user's Writing tab renders it in an
-- iframe, and the iframe posts CDI_SUBMIT back to the parent with the
-- test payload — one flow for all three skills.
--
-- Column strategy:
--   * writing_file_url    — NEW, holds the storage URL of the uploaded
--                           writing test HTML/ZIP.
--   * writing_task1_topic / writing_task2_topic / writing_task1_image_url
--                         — KEPT AS-IS. Not dropped: existing scheduled
--                           sessions may still be relying on the old
--                           React form until admin migrates each one to
--                           the file flow, and dropping the columns
--                           would break the fallback path in the client.
--                           They just stop being written to for new
--                           schedules once the admin panel switches
--                           over. A future migration can prune them
--                           after everything has moved.

alter table public.mock_schedules
  add column if not exists writing_file_url text;
