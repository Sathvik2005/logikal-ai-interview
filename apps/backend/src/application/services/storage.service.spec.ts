import { StorageService } from "./storage.service";

const mockBucketApi = {
  upload: jest.fn().mockResolvedValue({ error: null }),
  getPublicUrl: jest
    .fn()
    .mockReturnValue({
      data: { publicUrl: "https://x.supabase.co/storage/v1/object/public/resumes/c1/a.pdf" },
    }),
  createSignedUrl: jest
    .fn()
    .mockResolvedValue({ data: { signedUrl: "https://signed" }, error: null }),
  download: jest.fn(),
};
const mockClient = {
  storage: {
    listBuckets: jest.fn().mockResolvedValue({ data: [{ id: "resumes" }], error: null }),
    createBucket: jest.fn().mockResolvedValue({ error: null }),
    from: jest.fn().mockReturnValue(mockBucketApi),
  },
};
jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn(() => mockClient) }));

describe("StorageService", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    jest.clearAllMocks();
  });

  it("uses Supabase storage with a short sb_secret_ key (no length heuristic)", async () => {
    process.env.SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_short_key_43_characters_long_abc";
    delete process.env.STORAGE_DRIVER;
    const svc = new StorageService();

    const url = await svc.uploadFile("resumes", "c1/a.pdf", Buffer.from("x"), "application/pdf");

    expect(mockBucketApi.upload).toHaveBeenCalledWith("c1/a.pdf", expect.any(Buffer), {
      contentType: "application/pdf",
      upsert: true,
    });
    expect(url).toContain("/resumes/c1/a.pdf");
  });

  it("creates every bucket the app writes to, including identity and snapshots", async () => {
    process.env.SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_short_key_43_characters_long_abc";
    await new StorageService().onModuleInit();

    const created = mockClient.storage.createBucket.mock.calls.map((c) => c[0]);
    expect(created).toEqual(
      expect.arrayContaining(["identity", "snapshots", "reports", "recordings"]),
    );
    expect(created).not.toContain("resumes");
  });

  it("refuses to fall back to local disk in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => new StorageService()).toThrow(/Refusing to use local disk in production/);
  });

  it("extractKey handles Supabase URLs, signed URLs, local URLs and raw keys", () => {
    process.env.SUPABASE_URL = "https://x.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_short_key_43_characters_long_abc";
    const svc = new StorageService();
    expect(
      svc.extractKey(
        "https://x.supabase.co/storage/v1/object/public/resumes/c1/1_a%20b.pdf",
        "resumes",
      ),
    ).toBe("c1/1_a b.pdf");
    expect(
      svc.extractKey(
        "https://x.supabase.co/storage/v1/object/sign/resumes/c1/a.pdf?token=t",
        "resumes",
      ),
    ).toBe("c1/a.pdf");
    expect(svc.extractKey("http://localhost:3000/api/storage/resumes/c1/a.pdf", "resumes")).toBe(
      "c1/a.pdf",
    );
    expect(svc.extractKey("c1/a.pdf", "resumes")).toBe("c1/a.pdf");
  });
});
