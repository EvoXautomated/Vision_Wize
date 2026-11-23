-- Rellena la clave de búsqueda (nombre sin acentos) de las fichas existentes.
CREATE EXTENSION IF NOT EXISTS unaccent;
UPDATE "Client" SET "searchKey" = lower(unaccent("firstName" || ' ' || "lastName")) WHERE "searchKey" = '';
