import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { QUOTE_OPERATION_PHOTOS_BUCKET } from "./quotes/quotePhotos";

const SQL = readFileSync(resolve(process.cwd(), "supabase/migrations/20260923100000_marketplace_quote_size_blocks_photos.sql"), "utf8");

describe("blocs de formats et photos des devis", () => {
  it("rend les clés de ligne stables et recopie les blocs dans les factures", () => {
    expect(SQL).toContain("marketplace_binder_quote_items_line_key_uidx");
    expect(SQL).toContain("block_book_count");
    expect(SQL).toContain("INSERT INTO public.marketplace_binder_invoice_items");
    expect(SQL).toContain("line_key, block_key, block_label, block_book_count");
  });

  it("garde les photos privées derrière les fonctions serveur", () => {
    expect(SQL).toContain(`'${QUOTE_OPERATION_PHOTOS_BUCKET}'`);
    expect(SQL).toContain("FALSE, 8388608");
    expect(SQL).toContain("FOR ALL TO anon, authenticated");
    expect(SQL).toContain("USING (FALSE) WITH CHECK (FALSE)");
    expect(SQL).toContain("GRANT ALL ON public.marketplace_binder_quote_item_photos TO service_role");
  });

  it("préserve les photos des lignes conservées lors de l'édition d'un brouillon", () => {
    expect(SQL).toContain("DEFERRABLE INITIALLY DEFERRED");
    expect(SQL).toContain("NOT EXISTS (SELECT 1 FROM public.marketplace_binder_quote_items");
  });
});
