CREATE TABLE IF NOT EXISTS "aiOutput" (
  id SERIAL PRIMARY KEY,
  "formData" VARCHAR,
  "aiResponse" TEXT,
  "templateSlug" VARCHAR,
  "createdBy" VARCHAR,
  "createdAt" VARCHAR
);
