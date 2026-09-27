-- modelo_perfilado.sql
-- PostgreSQL
-- Modelo de datos de perfilado + tabla técnica Transactional Outbox.
-- Idempotente para creación de objetos: puede ejecutarse más de una vez sin recrear
-- tablas, índices o constraints ya existentes.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- DOMINIO
-- ============================================================
CREATE TABLE IF NOT EXISTS dominio (
    id_dominio          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre              VARCHAR(253) NOT NULL,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion  TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_dominio_nombre_ci
    ON dominio (LOWER(nombre));

-- ============================================================
-- USUARIO
-- ============================================================
CREATE TABLE IF NOT EXISTS usuario (
    id_usuario          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_dominio          UUID NOT NULL,
    email               VARCHAR(254) NOT NULL,
    nombre              VARCHAR(100) NOT NULL,
    apellido            VARCHAR(100) NOT NULL,
    activo              BOOLEAN NOT NULL,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion  TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_usuario_email
    ON usuario (email);

CREATE INDEX IF NOT EXISTS ix_usuario_id_dominio
    ON usuario (id_dominio);

-- ============================================================
-- CREDENCIAL
-- ============================================================
CREATE TABLE IF NOT EXISTS credencial (
    id_usuario                      UUID PRIMARY KEY,
    password_hash                   VARCHAR(512) NOT NULL,
    bloqueada                       BOOLEAN NOT NULL DEFAULT FALSE,
    intentos_fallidos_consecutivos  INTEGER NOT NULL DEFAULT 0,
    cambio_password_requerido       BOOLEAN NOT NULL,
    fecha_ultimo_cambio_password    TIMESTAMPTZ NOT NULL
);

-- ============================================================
-- ROL
-- ============================================================
CREATE TABLE IF NOT EXISTS rol (
    id_rol              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre              VARCHAR(100) NOT NULL,
    descripcion         VARCHAR(100) NOT NULL,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    protegido           BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion  TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_rol_nombre_ci
    ON rol (LOWER(nombre));

-- ============================================================
-- MODULO
-- ============================================================
CREATE TABLE IF NOT EXISTS modulo (
    id_modulo             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo                VARCHAR(50) NOT NULL,
    nombre                VARCHAR(100) NOT NULL,
    descripcion           VARCHAR(100) NOT NULL,
    activo                BOOLEAN NOT NULL DEFAULT TRUE,
    orden_visualizacion   INTEGER NOT NULL,
    fecha_creacion        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion    TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_modulo_codigo
    ON modulo (codigo);

-- ============================================================
-- PERMISO
-- ============================================================
CREATE TABLE IF NOT EXISTS permiso (
    id_permiso          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_modulo           UUID NOT NULL,
    codigo              VARCHAR(100) NOT NULL,
    descripcion         VARCHAR(100) NOT NULL,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion  TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_permiso_codigo
    ON permiso (codigo);

CREATE INDEX IF NOT EXISTS ix_permiso_id_modulo
    ON permiso (id_modulo);

-- ============================================================
-- USUARIO_ROL
-- ============================================================
CREATE TABLE IF NOT EXISTS usuario_rol (
    id_usuario        UUID NOT NULL,
    id_rol            UUID NOT NULL,
    fecha_asignacion  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_usuario_rol PRIMARY KEY (id_usuario, id_rol)
);

CREATE INDEX IF NOT EXISTS ix_usuario_rol_id_rol
    ON usuario_rol (id_rol);

-- ============================================================
-- ROL_PERMISO
-- ============================================================
CREATE TABLE IF NOT EXISTS rol_permiso (
    id_rol            UUID NOT NULL,
    id_permiso        UUID NOT NULL,
    fecha_asignacion  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_rol_permiso PRIMARY KEY (id_rol, id_permiso)
);

CREATE INDEX IF NOT EXISTS ix_rol_permiso_id_permiso
    ON rol_permiso (id_permiso);

-- ============================================================
-- OUTBOX_EVENT (tabla técnica)
-- ============================================================
CREATE TABLE IF NOT EXISTS outbox_event (
    id_evento              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_evento            VARCHAR(100) NOT NULL,
    payload                JSONB NOT NULL,
    fecha_creacion         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_publicacion      TIMESTAMPTZ NULL,
    intentos_publicacion   INTEGER NOT NULL DEFAULT 0,
    ultimo_error           TEXT NULL
);

-- Optimiza la lectura periódica de eventos todavía pendientes.
CREATE INDEX IF NOT EXISTS ix_outbox_event_pendientes
    ON outbox_event (fecha_creacion)
    WHERE fecha_publicacion IS NULL;

-- Optimiza el proceso de purga de publicados con antigüedad > 24 horas.
CREATE INDEX IF NOT EXISTS ix_outbox_event_publicados
    ON outbox_event (fecha_publicacion)
    WHERE fecha_publicacion IS NOT NULL;

-- ============================================================
-- FOREIGN KEYS
-- Se agregan condicionalmente para permitir re-ejecución.
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_usuario_dominio'
    ) THEN
        ALTER TABLE usuario
            ADD CONSTRAINT fk_usuario_dominio
            FOREIGN KEY (id_dominio)
            REFERENCES dominio(id_dominio)
            ON DELETE RESTRICT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_credencial_usuario'
    ) THEN
        ALTER TABLE credencial
            ADD CONSTRAINT fk_credencial_usuario
            FOREIGN KEY (id_usuario)
            REFERENCES usuario(id_usuario)
            ON DELETE RESTRICT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_permiso_modulo'
    ) THEN
        ALTER TABLE permiso
            ADD CONSTRAINT fk_permiso_modulo
            FOREIGN KEY (id_modulo)
            REFERENCES modulo(id_modulo)
            ON DELETE RESTRICT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_usuario_rol_usuario'
    ) THEN
        ALTER TABLE usuario_rol
            ADD CONSTRAINT fk_usuario_rol_usuario
            FOREIGN KEY (id_usuario)
            REFERENCES usuario(id_usuario)
            ON DELETE RESTRICT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_usuario_rol_rol'
    ) THEN
        ALTER TABLE usuario_rol
            ADD CONSTRAINT fk_usuario_rol_rol
            FOREIGN KEY (id_rol)
            REFERENCES rol(id_rol)
            ON DELETE RESTRICT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_rol_permiso_rol'
    ) THEN
        ALTER TABLE rol_permiso
            ADD CONSTRAINT fk_rol_permiso_rol
            FOREIGN KEY (id_rol)
            REFERENCES rol(id_rol)
            ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_rol_permiso_permiso'
    ) THEN
        ALTER TABLE rol_permiso
            ADD CONSTRAINT fk_rol_permiso_permiso
            FOREIGN KEY (id_permiso)
            REFERENCES permiso(id_permiso)
            ON DELETE RESTRICT;
    END IF;
END $$;

COMMIT;

-- ============================================================
-- POLÍTICA OPERATIVA DE OUTBOX
-- ============================================================
-- Los eventos con fecha_publicacion IS NULL nunca deben purgarse por antigüedad.
-- Los eventos publicados pueden eliminarse una vez transcurridas 24 horas:
--
-- DELETE FROM outbox_event
-- WHERE fecha_publicacion IS NOT NULL
--   AND fecha_publicacion < CURRENT_TIMESTAMP - INTERVAL '24 hours';
--
-- La ejecución periódica de esta sentencia corresponde a infraestructura/scheduling,
-- no a este DDL.
