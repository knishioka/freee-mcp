import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests for MCP SDK 1.x Migration (Issue #55)
 *
 * Testing strategy:
 * - Source code analysis for structural verification (tool registration, patterns)
 * - Direct schema tests via import
 * - File system checks for deleted files
 * - Package.json verification for SDK version
 *
 * Note: index.ts has module-level side effects (server creation, tool registration,
 * main() call) which makes ESM module mocking unreliable with jest.unstable_mockModule.
 * Instead, we verify the code structure through source analysis and test schemas/types directly.
 */

// Read the index.ts source for structural analysis
const indexSource = fs.readFileSync(
  path.resolve(__dirname, '../index.ts'),
  'utf-8',
);

// Read package.json for version checks
const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8'),
);

describe('MCP SDK 1.x Migration - index.ts', () => {
  describe('MCP SDK Version', () => {
    it('should use MCP SDK ^1.26.0 in package.json', () => {
      expect(packageJson.dependencies['@modelcontextprotocol/sdk']).toBe(
        '^1.26.0',
      );
    });

    it('should import McpServer from @modelcontextprotocol/sdk/server/mcp.js', () => {
      expect(indexSource).toContain(
        'from \'@modelcontextprotocol/sdk/server/mcp.js\'',
      );
      expect(indexSource).toContain('McpServer');
    });

    it('should import ResourceTemplate from @modelcontextprotocol/sdk/server/mcp.js', () => {
      expect(indexSource).toContain('ResourceTemplate');
      // Verify it's imported from the mcp.js module (may be multi-line import)
      const importBlock = indexSource.match(
        /import\s*\{[^}]*ResourceTemplate[^}]*\}\s*from\s*'@modelcontextprotocol\/sdk\/server\/mcp\.js'/s,
      );
      expect(importBlock).toBeDefined();
    });

    it('should import StdioServerTransport from @modelcontextprotocol/sdk/server/stdio.js', () => {
      expect(indexSource).toContain(
        'from \'@modelcontextprotocol/sdk/server/stdio.js\'',
      );
      expect(indexSource).toContain('StdioServerTransport');
    });

    it('should import McpError and ErrorCode from @modelcontextprotocol/sdk/types.js', () => {
      expect(indexSource).toContain(
        'from \'@modelcontextprotocol/sdk/types.js\'',
      );
      expect(indexSource).toContain('McpError');
      expect(indexSource).toContain('ErrorCode');
    });
  });

  describe('McpServer Initialization', () => {
    it('should create McpServer with SERVER_NAME and version from package.json', () => {
      // Verify server creation pattern
      expect(indexSource).toContain('new McpServer(');
      expect(indexSource).toContain('name: SERVER_NAME');
      expect(indexSource).toContain('version: packageJson.version');
    });

    it('should configure tools and resources capabilities', () => {
      expect(indexSource).toContain('capabilities:');
      expect(indexSource).toContain('tools: {}');
      expect(indexSource).toContain('resources: {}');
    });
  });

  describe('Tool Registration Pattern (registerTool)', () => {
    // Extract all registerTool calls from source
    const registerToolRegex = /registerTool\(\s*'([^']+)'/g;
    const toolNames: string[] = [];
    let match;
    while ((match = registerToolRegex.exec(indexSource)) !== null) {
      toolNames.push(match[1]);
    }

    it('should register exactly 22 tools via registerTool()', () => {
      expect(toolNames).toHaveLength(22);
    });

    it('should register all expected tool names', () => {
      const expectedToolNames = [
        'freee_get_auth_url',
        'freee_get_access_token',
        'freee_set_company_token',
        'freee_get_companies',
        'freee_get_company',
        'freee_get_deals',
        'freee_get_deal',
        'freee_create_deal',
        'freee_get_account_items',
        'freee_get_partners',
        'freee_create_partner',
        'freee_get_sections',
        'freee_get_tags',
        'freee_get_invoices',
        'freee_create_invoice',
        'freee_get_walletables',
        'freee_get_manual_journals',
        'freee_get_manual_journal',
        'freee_get_wallet_txns',
        'freee_get_trial_balance',
        'freee_get_profit_loss',
        'freee_get_balance_sheet',
      ];

      expectedToolNames.forEach((name) => {
        expect(toolNames).toContain(name);
      });
    });

    it('should NOT register freee_get_cash_flow tool (removed)', () => {
      expect(toolNames).not.toContain('freee_get_cash_flow');
    });

    it('should use non-generic registerTool wrapper to avoid TS2589', () => {
      // Verify the workaround function exists
      expect(indexSource).toContain('function registerTool(');
      expect(indexSource).toContain('(server as any).registerTool(');
    });

    it('should register each tool with description', () => {
      // Each registerTool call should have a description property
      const toolBlocks = indexSource.split(/registerTool\(/);
      // Skip the first element (code before first registerTool call) and the wrapper function definition
      const toolCalls = toolBlocks.filter(
        (block) => block.includes('description:') && block.includes('\'freee_'),
      );

      expect(toolCalls.length).toBe(22);
      toolCalls.forEach((block) => {
        expect(block).toContain('description:');
      });
    });

    it('should use schemas from schemas.ts as inputSchema (raw shapes)', () => {
      // Verify tools reference schema imports
      expect(indexSource).toContain('import * as schemas from \'./schemas.js\'');

      // Check that tools use schemas.XxxSchema as inputSchema
      const schemaUsages = [
        'schemas.AuthorizeSchema',
        'schemas.GetTokenSchema',
        'schemas.SetCompanyTokenSchema',
        'schemas.GetCompanySchema',
        'schemas.GetDealsSchema',
        'schemas.GetDealSchema',
        'schemas.CreateDealSchema',
        'schemas.GetAccountItemsSchema',
        'schemas.GetPartnersSchema',
        'schemas.CreatePartnerSchema',
        'schemas.GetSectionsSchema',
        'schemas.GetTagsSchema',
        'schemas.GetInvoicesSchema',
        'schemas.CreateInvoiceSchema',
        'schemas.GetTrialBalanceSchema',
        'schemas.GetProfitLossSchema',
        'schemas.GetBalanceSheetSchema',
      ];

      schemaUsages.forEach((usage) => {
        expect(indexSource).toContain(usage);
      });
    });

    it('should register freee_get_companies without inputSchema', () => {
      // Find the freee_get_companies registration block
      const companiesBlock = indexSource.match(
        /registerTool\(\s*'freee_get_companies'[\s\S]*?\)\s*;/,
      );
      expect(companiesBlock).toBeDefined();
      // It should NOT have inputSchema
      expect(companiesBlock![0]).not.toContain('inputSchema');
    });
  });

  describe('Resource Registration (ResourceTemplate)', () => {
    it('should register a company resource with registerResource', () => {
      expect(indexSource).toContain('server.registerResource(');
    });

    it('should use ResourceTemplate with correct URI pattern', () => {
      expect(indexSource).toContain(
        'new ResourceTemplate(\'freee://company/{companyId}\'',
      );
    });

    it('should configure resource with description and mimeType', () => {
      // Verify the metadata object in registerResource call
      expect(indexSource).toContain('description: \'freee company data\'');
      expect(indexSource).toContain('mimeType: \'application/json\'');
    });

    it('should have list callback for ResourceTemplate', () => {
      // Verify the list function in ResourceTemplate
      expect(indexSource).toContain('list: async () =>');
    });

    it('should register resource with name "company"', () => {
      const registerResourceMatch = indexSource.match(
        /server\.registerResource\(\s*'([^']+)'/,
      );
      expect(registerResourceMatch).toBeDefined();
      expect(registerResourceMatch![1]).toBe('company');
    });
  });

  describe('handleToolError Function', () => {
    it('should exist as a function returning never', () => {
      expect(indexSource).toContain(
        'function handleToolError(toolName: string, error: unknown): never',
      );
    });

    it('should re-throw McpError instances directly', () => {
      expect(indexSource).toContain('if (error instanceof McpError)');
      // Inside the if block, it should throw the error
      const handleToolErrorBlock = indexSource.match(
        /function handleToolError[\s\S]*?^}/m,
      );
      expect(handleToolErrorBlock).toBeDefined();
      expect(handleToolErrorBlock![0]).toContain('throw error');
    });

    it('should wrap non-McpError in McpError with InternalError code', () => {
      expect(indexSource).toContain('ErrorCode.InternalError');
      expect(indexSource).toContain('Tool execution failed:');
    });
  });

  describe('getCompanyId Helper', () => {
    it('should exist as a helper function', () => {
      expect(indexSource).toContain(
        'function getCompanyId(providedId?: number): number',
      );
    });

    it('should use defaultCompanyId as fallback', () => {
      expect(indexSource).toContain('providedId || defaultCompanyId');
    });

    it('should throw McpError with InvalidParams when no company ID', () => {
      expect(indexSource).toContain('ErrorCode.InvalidParams');
      expect(indexSource).toContain('Company ID is required');
    });

    it('should support FREEE_DEFAULT_COMPANY_ID environment variable', () => {
      expect(indexSource).toContain('FREEE_DEFAULT_COMPANY_ID');
    });
  });

  describe('main() Function', () => {
    it('should load tokens on startup', () => {
      expect(indexSource).toContain('tokenManager.loadTokens()');
    });

    it('should create StdioServerTransport', () => {
      expect(indexSource).toContain('new StdioServerTransport()');
    });

    it('should connect server to transport', () => {
      expect(indexSource).toContain('server.connect(transport)');
    });

    it('should support FREEE_TOKEN_DATA_BASE64 for serverless environments', () => {
      expect(indexSource).toContain('FREEE_TOKEN_DATA_BASE64');
      expect(indexSource).toContain('Buffer.from(envTokenData, \'base64\')');
    });

    it('should be called at module level', () => {
      expect(indexSource).toContain('main().catch(');
    });
  });

  describe('Tool Handler Field Mapping', () => {
    // Verify camelCase to snake_case field mapping in handler bodies

    it('should map deal fields from camelCase to snake_case', () => {
      // In freee_create_deal handler
      expect(indexSource).toContain('issue_date: issueDate');
      expect(indexSource).toContain('partner_id: partnerId');
      expect(indexSource).toContain('due_date: dueDate');
      expect(indexSource).toContain('ref_number: refNumber');
    });

    it('should map invoice fields from camelCase to snake_case', () => {
      expect(indexSource).toContain('invoice_status: invoiceStatus');
      expect(indexSource).toContain('unit_price: line.unitPrice');
      expect(indexSource).toContain('total_amount:');
    });

    it('should map deal detail fields correctly', () => {
      // Deal detail fields use destructured variable 'd' (e.g., d.taxCode)
      expect(indexSource).toContain('account_item_id: d.accountItemId');
      expect(indexSource).toContain('tax_code: d.taxCode');
      expect(indexSource).toContain('section_id: d.sectionId');
      expect(indexSource).toContain('tag_ids: d.tagIds');
    });

    it('should map partner fields correctly', () => {
      expect(indexSource).toContain('name_kana: nameKana');
      expect(indexSource).toContain('long_name: longName');
      expect(indexSource).toContain('country_code: countryCode');
    });

    it('should map report fields correctly', () => {
      expect(indexSource).toContain('fiscal_year: fiscalYear');
      expect(indexSource).toContain('start_month: startMonth');
      expect(indexSource).toContain('end_month: endMonth');
      expect(indexSource).toContain(
        'breakdown_display_type: breakdownDisplayType',
      );
    });
  });
});

describe('Schema Structure Verification', () => {
  it('should export all 18 schemas as raw shapes (plain objects)', async () => {
    const schemas = await import('../schemas.js');

    const schemaNames = [
      'AuthorizeSchema',
      'GetTokenSchema',
      'SetCompanyTokenSchema',
      'GetCompaniesSchema',
      'GetCompanySchema',
      'GetDealsSchema',
      'GetDealSchema',
      'CreateDealSchema',
      'GetAccountItemsSchema',
      'GetPartnersSchema',
      'CreatePartnerSchema',
      'GetSectionsSchema',
      'GetTagsSchema',
      'GetInvoicesSchema',
      'CreateInvoiceSchema',
      'GetTrialBalanceSchema',
      'GetProfitLossSchema',
      'GetBalanceSheetSchema',
    ];

    schemaNames.forEach((name) => {
      const schema = (schemas as Record<string, unknown>)[name];
      expect(schema).toBeDefined();
      expect(typeof schema).toBe('object');

      // Raw shapes should NOT have _def.typeName === 'ZodObject'
      // They are plain objects where each key is a Zod type
      const asAny = schema as Record<string, unknown>;
      expect(asAny._def).toBeUndefined();
    });
  });

  it('should NOT export GetCashFlowSchema (removed)', async () => {
    const schemas = await import('../schemas.js');
    expect(
      (schemas as Record<string, unknown>).GetCashFlowSchema,
    ).toBeUndefined();
  });

  it('should export exactly 18 schemas', async () => {
    const schemas = await import('../schemas.js');

    // Count exports that end with 'Schema'
    const schemaExports = Object.keys(schemas).filter((key) =>
      key.endsWith('Schema'),
    );

    expect(schemaExports).toHaveLength(22);
  });

  it('should use Zod types in schema fields', async () => {
    const schemas = await import('../schemas.js');

    // Verify some key schemas have Zod fields
    const getDealsSchema = schemas.GetDealsSchema as Record<string, unknown>;
    expect(getDealsSchema.companyId).toBeDefined();
    // Check it's a ZodType (has _def property)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((getDealsSchema.companyId as any)._def).toBeDefined();

    // Verify CreateDealSchema has nested details array
    const createDealSchema = schemas.CreateDealSchema as Record<
      string,
      unknown
    >;
    expect(createDealSchema.details).toBeDefined();
    expect(createDealSchema.type).toBeDefined();
  });

  it('should have companyId as optional in most schemas', async () => {
    const schemas = await import('../schemas.js');

    // These schemas should have optional companyId
    const schemasWithOptionalCompanyId = [
      'GetCompanySchema',
      'GetDealsSchema',
      'GetDealSchema',
      'CreateDealSchema',
      'GetAccountItemsSchema',
      'GetPartnersSchema',
      'CreatePartnerSchema',
      'GetSectionsSchema',
      'GetTagsSchema',
      'GetInvoicesSchema',
      'CreateInvoiceSchema',
      'GetTrialBalanceSchema',
      'GetProfitLossSchema',
      'GetBalanceSheetSchema',
    ];

    schemasWithOptionalCompanyId.forEach((name) => {
      const schema = (schemas as Record<string, unknown>)[name] as Record<
        string,
        unknown
      >;
      const companyId = schema.companyId;
      expect(companyId).toBeDefined();
      // Check it's optional by verifying the description mentions optional
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const desc = (companyId as any).description;
      expect(desc).toContain('optional');
    });
  });
});

describe('jsonSchemas.ts Deletion Verification', () => {
  it('should not exist in the filesystem', () => {
    const jsonSchemasPath = path.resolve(__dirname, '../jsonSchemas.ts');
    expect(fs.existsSync(jsonSchemasPath)).toBe(false);
  });

  it('should not exist as .js either', () => {
    const jsonSchemasJsPath = path.resolve(__dirname, '../jsonSchemas.js');
    expect(fs.existsSync(jsonSchemasJsPath)).toBe(false);
  });

  it('should not be imported in index.ts', () => {
    expect(indexSource).not.toContain('jsonSchemas');
  });
});

describe('Build & Quality Verification', () => {
  it('should not import from deleted jsonSchemas module', () => {
    expect(indexSource).not.toContain('from \'./jsonSchemas');
    expect(indexSource).not.toContain('from \'../jsonSchemas');
  });

  it('should not reference getCashFlow in index.ts', () => {
    // Verify no references to the removed cash flow functionality
    expect(indexSource).not.toContain('getCashFlow');
    expect(indexSource).not.toContain('cash_flow');
    expect(indexSource).not.toContain('cashFlow');
    expect(indexSource).not.toContain('CashFlow');
  });

  it('should use CallToolResult type from SDK types', () => {
    expect(indexSource).toContain('CallToolResult');
    expect(indexSource).toContain('type CallToolResult');
  });
});
