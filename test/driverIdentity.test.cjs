const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
function harness(create) {
 const source = fs.readFileSync(path.join(__dirname, '../app/management/drivers/create.tsx'), 'utf8');
 const ast = ts.createSourceFile('create.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
 const functions = [];
 function visit(node) { if (ts.isFunctionDeclaration(node) && ['checkNationalId','validate','handleSave'].includes(node.name?.text)) functions.push(node.getText(ast)); ts.forEachChild(node,visit); } visit(ast);
 let errors = {};
 const apiCalls = { get: 0, post: 0 };
 const context = { form: { vendorId:'V001', nationalId:'12345678', firstName:'Anne', middleName:'', surname:'Omondi', phone:'0700000000', licenseNumber:'DL1', email:'', licenseClass:'', licenseExpiry:'', emergencyContact:'', status:'active' }, saving:false, identityCheckVersion:{current:0}, saveAttemptVersion:{current:0}, api:{get:async()=>{apiCalls.get++;return {data:{available:true}}},post:async()=>{apiCalls.post++;throw new Error('unexpected lookup')}}, driverId:undefined, isEditMode:false, driverRepository:{create}, photoUri:null, setSaving:()=>{}, setUploadingPhoto:()=>{}, setErrors:fn=>{ errors=typeof fn==='function'?fn(errors):fn; }, Alert:{alert:()=>{}}, resetForm:()=>{}, module:{exports:{}} };
 vm.runInNewContext(ts.transpileModule(functions.join('\n')+'\nmodule.exports = { handleSave };',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);
 return {save:context.module.exports.handleSave,form:context.form,errors:()=>errors,source,apiCalls};
}
test('manual driver create saves entered identity without calling IPRS',async()=>{
 const sent=[]; const h=harness(async body=>{sent.push(body);return {id:'D001'};});
 await h.save();
 assert.equal(sent.length,1); assert.equal(sent[0].firstName,'Anne'); assert.equal(sent[0].surname,'Omondi');
 assert.equal(sent[0].registrationSource,'MANUAL'); assert.equal(h.apiCalls.get,1); assert.equal(h.apiCalls.post,0);
});
test('driver form does not automatically look up IPRS and keeps all profile inputs editable',async()=>{
 const h=harness(async()=>({id:'D001'}));
 assert.doesNotMatch(h.source,/lookup-identity|verify-identity|iprsEnabled/);
 for (const label of ['National ID','First Name','Middle Name (optional)','Surname','Phone Number','Email Address','License Number','License Class','License Expiry']) {
  const start=h.source.indexOf(`label="${label}"`);
  assert.notEqual(start,-1,`missing ${label} input`);
  assert.match(h.source.slice(start,start+240),/editable=\{true\}/,`${label} should be editable`);
 }
});

test('driver onboarding requires the license number', async () => {
 const sent = [];
 const h = harness(async body => { sent.push(body); return { id: 'D002' }; });
 h.form.licenseNumber = '';
 await h.save();
 assert.equal(sent.length, 0);
 assert.equal(h.errors().licenseNumber, 'License number is required');
});
