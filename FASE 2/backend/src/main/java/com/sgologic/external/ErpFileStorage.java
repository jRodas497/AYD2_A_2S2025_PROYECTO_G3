package com.sgologic.external;

import java.io.IOException;

/**
 * A dónde deja ErpDropClient el archivo para que el AS/400 lo recoja. Dos implementaciones:
 * LocalErpFileStorage (filesystem, lo de siempre) y R2ErpFileStorage (Cloudflare R2), elegidas
 * según exista o no R2_BUCKET — el mismo interruptor por presencia de variable que DATABASE_URL.
 */
public interface ErpFileStorage {

    void write(String fileName, String content) throws IOException;
}
