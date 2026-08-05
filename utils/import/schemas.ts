/**
 * Import schemas — column definitions per entity. Drives the template download,
 * the preview table header, and the client-side validator. Keep in sync with
 * the backend import.service.ts accepted keys.
 */

export type ImportEntity = 'clients' | 'pets' | 'inventory' | 'staff';

export interface ColumnDef {
  key: string;             // primary column name used in CSV/template
  label: string;           // human-friendly label
  required?: boolean;
  type?: 'string' | 'number' | 'date' | 'enum';
  enumValues?: string[];
  example?: string;
  help?: string;
  aliases?: string[];      // alternate accepted header names (backend also tolerates these)
}

export interface EntitySchema {
  entity: ImportEntity;
  title: string;
  subtitle: string;
  columns: ColumnDef[];
  sampleRows: Record<string, string>[];
}

export const CLIENT_SCHEMA: EntitySchema = {
  entity: 'clients',
  title: 'Clients',
  subtitle: 'Pet owners and their contact details.',
  columns: [
    { key: 'title',       label: 'Title',       example: 'Dr.' },
    { key: 'first_name',  label: 'First name',  required: true, example: 'Amina',  aliases: ['firstName'] },
    { key: 'second_name', label: 'Middle name', example: 'W.', aliases: ['secondName', 'middle_name'] },
    { key: 'surname',     label: 'Surname',     required: true, example: 'Otieno', aliases: ['last_name', 'lastName'] },
    { key: 'email',       label: 'Email',       example: 'amina@example.com' },
    { key: 'phone',       label: 'Phone',       required: true, example: '+254712345678' },
    { key: 'address',     label: 'Address',     example: 'Kilimani, Nairobi' },
    { key: 'country',     label: 'Country',     example: 'Kenya',  help: 'Defaults to Kenya' },
    { key: 'currency',    label: 'Currency',    example: 'KES',    help: 'ISO 4217 code. Defaults to KES' },
    { key: 'gender',      label: 'Gender',      example: 'F' },
    { key: 'dob',         label: 'Date of birth', type: 'date', example: '1988-04-12', help: 'YYYY-MM-DD' },
  ],
  sampleRows: [
    {
      title: 'Dr.', first_name: 'Amina', second_name: '', surname: 'Otieno',
      email: 'amina@example.com', phone: '+254712345678',
      address: 'Kilimani, Nairobi', country: 'Kenya', currency: 'KES',
      gender: 'F', dob: '1988-04-12',
    },
    {
      title: '', first_name: 'Kevin', second_name: '', surname: 'Mokoena',
      email: '', phone: '+27821234567',
      address: 'Cape Town', country: 'South Africa', currency: 'ZAR',
      gender: 'M', dob: '',
    },
  ],
};

export const PET_SCHEMA: EntitySchema = {
  entity: 'pets',
  title: 'Pets',
  subtitle: 'Patient records. Each pet must link to an existing client by email or phone.',
  columns: [
    { key: 'name',              label: 'Pet name',     required: true, example: 'Simba' },
    { key: 'species',           label: 'Species',      required: true, example: 'Dog' },
    { key: 'breed',             label: 'Breed',        example: 'Labrador' },
    { key: 'gender',            label: 'Gender',       example: 'M' },
    { key: 'dob',               label: 'Date of birth', type: 'date', required: true, example: '2022-05-10', help: 'YYYY-MM-DD' },
    { key: 'weight_kg',         label: 'Weight (kg)',  type: 'number', example: '12.4', aliases: ['weight', 'weight_value'] },
    { key: 'rfid_chip_number',  label: 'RFID chip #',  example: '981020000123456', aliases: ['rfid'] },
    { key: 'tag_number',        label: 'Tag #',        example: 'A-001', aliases: ['tag'] },
    { key: 'owner_email',       label: 'Owner email',  example: 'amina@example.com', help: 'Either owner_email or owner_phone is required' },
    { key: 'owner_phone',       label: 'Owner phone',  example: '+254712345678' },
  ],
  sampleRows: [
    {
      name: 'Simba', species: 'Dog', breed: 'Labrador', gender: 'M',
      dob: '2022-05-10', weight_kg: '12.4', rfid_chip_number: '', tag_number: 'A-001',
      owner_email: 'amina@example.com', owner_phone: '+254712345678',
    },
    {
      name: 'Mittens', species: 'Cat', breed: 'British Shorthair', gender: 'F',
      dob: '2023-02-18', weight_kg: '4.1', rfid_chip_number: '', tag_number: '',
      owner_email: '', owner_phone: '+27821234567',
    },
  ],
};

export const INVENTORY_SCHEMA: EntitySchema = {
  entity: 'inventory',
  title: 'Inventory',
  subtitle: 'Medicines, consumables, and equipment stocked in your clinic. Columns mirror the Add Product form — subcategory path, supplier, per-unit pricing and service charges.',
  columns: [
    // ── Identity & categorisation ──
    { key: 'name',          label: 'Item name', required: true, example: 'Amoxicillin 250mg' },
    { key: 'main_category', label: 'Main category', type: 'enum', enumValues: ['MEDICINE', 'CONSUMABLE'], example: 'MEDICINE', help: 'Defaults to MEDICINE', aliases: ['mainCategory'] },
    { key: 'category',      label: 'Category',  example: 'Antibiotics', help: 'Most specific subcategory. Leave blank to take the LAST step of subcategories' },
    // The Add Product form builds an ordered, reorderable path
    // (Medicine › Antimicrobial › Antibiotics) and stores its last step in the
    // `category` column. Import could only ever express one level, so an
    // imported item lost the structure the form gives it.
    { key: 'subcategories', label: 'Subcategory path', example: 'Antimicrobial;Antibiotics', help: 'Semicolon-separated, broadest first. The last step becomes Category', aliases: ['subcategory_path', 'subCategories'] },
    { key: 'sku',           label: 'SKU',       required: true, example: 'AMX-250', help: 'Unique within YOUR clinic — another clinic may use the same SKU' },
    // ── Product details ──
    { key: 'supplier',           label: 'Supplier', example: 'Cosmos Distributors', help: 'Matched by name against your suppliers. Unknown name = left unlinked, not an error', aliases: ['supplier_name', 'supplierName'] },
    { key: 'manufacturer',       label: 'Manufacturer', example: 'Cosmos Pharma' },
    { key: 'country_of_origin',  label: 'Country of origin', example: 'Kenya', aliases: ['countryOfOrigin'] },
    { key: 'storage_conditions', label: 'Storage conditions', example: 'Room temperature', aliases: ['storageConditions'] },
    { key: 'prescription_only',  label: 'Prescription only', type: 'enum', enumValues: ['YES', 'NO'], example: 'NO', help: 'Defaults to NO', aliases: ['prescriptionOnly'] },
    { key: 'species',            label: 'Species', example: 'Dog;Cat', help: 'Semicolon-separated target species. Blank = all species' },
    // ── Stock & batch ──
    { key: 'batch_number',  label: 'Batch #',    example: 'B-2026-03', aliases: ['currentBatchNumber'] },
    { key: 'expiry_date',   label: 'Expiry date', type: 'date', example: '2027-06-30', help: 'YYYY-MM-DD', aliases: ['expiryDate'] },
    { key: 'unit',          label: 'Unit type', example: 'Tablet', help: 'Stock unit (Tablet, mL, Vial…). Defaults to Unit' },
    { key: 'pack_size',     label: 'Units per pack', type: 'number', example: '30', help: 'e.g. 30 tablets per box — bridges pack purchases to per-unit stock', aliases: ['packSize'] },
    { key: 'billable',      label: 'Billable', type: 'enum', enumValues: ['YES', 'NO'], example: 'YES', help: 'Defaults to YES' },
    // ── Levels & pricing ──
    { key: 'quantity',      label: 'Quantity',  type: 'number', example: '120', help: 'Fractional allowed (e.g. 0.5)' },
    { key: 'min_threshold', label: 'Min stock alert', type: 'number', example: '10', aliases: ['minThreshold', 'reorder_point'] },
    { key: 'max_level',     label: 'Max level', type: 'number', example: '500', aliases: ['maxLevel'] },
    { key: 'reorder_qty',   label: 'Reorder qty', type: 'number', example: '100', aliases: ['reorderQty'] },
    { key: 'barcode',       label: 'Barcode', example: '6161100123456' },
    { key: 'cost_price',    label: 'Cost price', type: 'number', example: '12.50', aliases: ['costPrice'] },
    { key: 'cost_unit',     label: 'Cost unit', example: 'Tablet', help: 'Unit the cost price is per. Defaults to unit', aliases: ['costUnit'] },
    { key: 'price',         label: 'Sale price', type: 'number', example: '25.00', help: 'Per sell_unit', aliases: ['sale_price'] },
    { key: 'sell_unit',     label: 'Sell unit', example: 'Tablet', help: 'Unit the sale price is per (can differ from stock unit). Defaults to unit', aliases: ['sellUnit'] },
    // ── Service charges — blank = not applied; a number (incl. 0) = applied ──
    { key: 'service_charge',     label: 'Service charge', type: 'number', example: '', help: 'Flat handling fee added when dispensed. Blank = not applied', aliases: ['serviceCharge'] },
    { key: 'administration_fee', label: 'Administration fee', type: 'number', example: '', help: 'Fee to administer the product. Blank = not applied', aliases: ['administrationFee', 'admin_fee'] },
    { key: 'injection_fee',      label: 'Injection fee', type: 'number', example: '300', help: 'Per injection. Blank = not applied', aliases: ['injectionFee'] },
    { key: 'injection_unit_ml',  label: 'Injection unit (mL)', type: 'number', example: '10', help: 'Volume per injection for the injection fee. Defaults to 10', aliases: ['injectionUnitMl'] },
    { key: 'prescription_fee',   label: 'Prescription fee', type: 'number', example: '', help: 'Fee to write the prescription. Blank = not applied', aliases: ['prescriptionFee'] },
  ],
  sampleRows: [
    {
      name: 'Amoxicillin 250mg', main_category: 'MEDICINE', category: 'Antibiotics',
      subcategories: 'Antimicrobial;Antibiotics', sku: 'AMX-250',
      supplier: 'Cosmos Distributors', manufacturer: 'Cosmos Pharma', country_of_origin: 'Kenya', storage_conditions: 'Room temperature',
      prescription_only: 'YES', species: 'Dog;Cat',
      batch_number: 'B-2026-03', expiry_date: '2027-06-30', unit: 'Tablet', pack_size: '30', billable: 'YES',
      quantity: '120', min_threshold: '20', max_level: '500', reorder_qty: '100', barcode: '6161100123456',
      cost_price: '12.50', cost_unit: 'Tablet', price: '25.00', sell_unit: 'Tablet',
      service_charge: '', administration_fee: '50', injection_fee: '', injection_unit_ml: '', prescription_fee: '100',
    },
    {
      name: 'Surgical Gloves', main_category: 'CONSUMABLE', category: 'PPE',
      subcategories: 'Theatre;PPE', sku: 'GLV-PAIR',
      supplier: '', manufacturer: '', country_of_origin: '', storage_conditions: '',
      prescription_only: 'NO', species: '',
      batch_number: '', expiry_date: '', unit: 'Box', pack_size: '50', billable: 'YES',
      quantity: '10', min_threshold: '2', max_level: '', reorder_qty: '', barcode: '',
      cost_price: '750.00', cost_unit: 'Box', price: '15.00', sell_unit: 'Pair',
      service_charge: '0', administration_fee: '', injection_fee: '', injection_unit_ml: '', prescription_fee: '',
    },
  ],
};

export const STAFF_SCHEMA: EntitySchema = {
  entity: 'staff',
  title: 'Staff',
  subtitle: 'Team members. Invited users activate via forgot-password.',
  columns: [
    { key: 'email',       label: 'Email',      required: true, example: 'dr.otieno@example.com' },
    { key: 'title',       label: 'Title',      example: 'Dr.' },
    { key: 'first_name',  label: 'First name', required: true, example: 'Amina', aliases: ['firstName'] },
    { key: 'second_name', label: 'Middle name', example: '', aliases: ['secondName'] },
    { key: 'surname',     label: 'Surname',    required: true, example: 'Otieno', aliases: ['last_name', 'lastName'] },
    {
      key: 'role',
      label: 'Role',
      required: true,
      type: 'enum',
      enumValues: ['VET', 'STAFF', 'CLINIC_OWNER', 'FREELANCER'],
      example: 'VET',
    },
    { key: 'phone',       label: 'Phone',      example: '+254712345678' },
  ],
  sampleRows: [
    {
      email: 'dr.otieno@example.com', title: 'Dr.', first_name: 'Amina',
      second_name: '', surname: 'Otieno', role: 'VET', phone: '+254712345678',
    },
    {
      email: 'kevin@example.com', title: 'Mr.', first_name: 'Kevin',
      second_name: '', surname: 'Mokoena', role: 'STAFF', phone: '+27821234567',
    },
  ],
};

export const SCHEMAS: Record<ImportEntity, EntitySchema> = {
  clients:   CLIENT_SCHEMA,
  pets:      PET_SCHEMA,
  inventory: INVENTORY_SCHEMA,
  staff:     STAFF_SCHEMA,
};

export const getSchema = (entity: ImportEntity): EntitySchema => SCHEMAS[entity];
