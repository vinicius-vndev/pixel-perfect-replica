import { describe, expect, it } from "vitest";
import {
  buildWhatsAppConfirmation,
  normalizePhone,
  parseBRLToCents,
  STATUS_TRANSITIONS,
  zonedToUtc,
} from "./detailhub";

describe("DetailHub rules", () => {
  it("builds the WhatsApp confirmation message", () => {
    const msg = buildWhatsAppConfirmation({
      customerName: "João Silva",
      businessName: "Auto Brilho",
      serviceName: "Lavagem técnica",
      startsAt: "2026-11-10T17:00:00Z",
      priceCents: 8000,
      address: "Rua A, 10",
      timezone: "America/Sao_Paulo",
    });
    expect(msg).toBe(
      "Olá, João! Seu agendamento na Auto Brilho foi confirmado para 10/11 às 14h. Serviço: lavagem técnica. Valor: R$ 80,00. Endereço: Rua A, 10. Até lá!",
    );
  });

  it("normalizes Brazilian phones with country code", () => {
    expect(normalizePhone("(11) 98765-4321")).toBe("5511987654321");
    expect(normalizePhone("+55 11 98765-4321")).toBe("5511987654321");
  });

  it("parses prices in reais to cents", () => {
    expect(parseBRLToCents("80,00")).toBe(8000);
    expect(parseBRLToCents("1.200,50")).toBe(120050);
    expect(parseBRLToCents("abc")).toBeNull();
  });

  it("only allows the defined status transitions", () => {
    expect(STATUS_TRANSITIONS.pendente).toEqual(["confirmado", "recusado", "cancelado"]);
    expect(STATUS_TRANSITIONS.confirmado).toEqual(["concluido", "cancelado", "nao_compareceu"]);
    expect(STATUS_TRANSITIONS.concluido).toEqual([]);
  });

  it("converts São Paulo wall time to UTC", () => {
    expect(zonedToUtc("2026-11-10", "14:00", "America/Sao_Paulo").toISOString()).toBe("2026-11-10T17:00:00.000Z");
  });
});
