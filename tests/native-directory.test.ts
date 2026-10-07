import { describe, expect, it } from "vitest";
import { directoryChoices } from "../src/native/directory";
const row = (id: string, locale: string, name: string, group: string, status = "published", address = "Rue de l’École") => ({ id, locale, translationGroup: group, status, data: { name, address, city: "Genève" } }) as any;
describe("saved directories", () => {
  it("groups translations, prefers event language and keeps a previously saved row identity", () => {
    const entries = [row("a", "en", "School", "school"), row("b", "fr", "École", "school"), row("c", "fr", "Mairie", "town")];
    const result = directoryChoices(entries, "fr", "a", "ecole", true);
    expect(result.choices).toHaveLength(2); // name and address match, not only the untranslated label
    expect(result.current).toMatchObject({ value: "a", name: "École", address: "Rue de l’École, Genève" });
    expect(result.choices.filter(choice => ["a", "b"].includes(choice.value))).toHaveLength(1);
    expect(directoryChoices(entries, "en", "a", "", true).current?.name).toBe("School");
  });
  it("prefers a published sibling, retains an explicitly selected draft, and handles missing translations", () => {
    const entries = [row("a", "en", "School", "g"), row("b", "fr", "École", "g", "draft")];
    expect(directoryChoices(entries, "fr", undefined).choices[0]).toMatchObject({ value: "a", name: "School", published: true });
    expect(directoryChoices(entries, "fr", "b").current).toMatchObject({ value: "b", published: false });
    expect(directoryChoices(entries, "de", "a").current?.label).toContain("[EN]");
    expect(directoryChoices(entries, "fr", "missing").current).toBeUndefined();
  });
  it("bounds large lists while retaining selections outside the search results", () => {
    const entries = Array.from({ length: 250 }, (_, index) => row(String(index), "fr", "Salle " + index, "g" + index));
    expect(directoryChoices(entries, "fr", undefined).choices).toHaveLength(80);
    const found = directoryChoices(entries, "fr", "249", "no matches");
    expect(found.matches).toBe(0); expect(found.choices).toHaveLength(1); expect(found.current?.value).toBe("249");
    expect(directoryChoices([], "fr", undefined).choices).toEqual([]);
  });
});
