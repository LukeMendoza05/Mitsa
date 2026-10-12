import {expect,it} from "vitest";
import pg from "pg";
import {testDatabaseConfig} from "../../scripts/postgres-config.mjs";

const approved={projectRef:"abcdefghijklmnopqrst",approvedByUser:true,purpose:"isolated-development-test",databaseMarker:"proof"};
const url="postgresql://postgres.abcdefghijklmnopqrst:synthetic%40password@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";

it("pins actual pg connection settings and verifies the published CA and hostname",()=>{
  const config=testDatabaseConfig(url,approved);
  const client=new pg.Client(config);
  expect(client.host).toBe("aws-0-ap-southeast-2.pooler.supabase.com");
  expect(client.user).toBe("postgres.abcdefghijklmnopqrst");
  expect(client.password).toBe("synthetic@password");
  expect(client.ssl).toEqual(expect.objectContaining({rejectUnauthorized:true,ca:expect.stringContaining("-----BEGIN CERTIFICATE-----")}));
  expect(client.ssl).not.toHaveProperty("checkServerIdentity");
  expect(config).not.toHaveProperty("connectionString");
});

it("rejects URL overrides before creating a connection configuration",()=>{
  for(const option of ["?host=unrelated.example","?ssl=0","?sslmode=disable"]){
    expect(()=>testDatabaseConfig(url+option,approved)).toThrow("database target");
  }
});
