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
 const context = { form: { vendorId:'V001', nationalId:'12345678', firstName:'Anne', surname:'Wrong', phone:'0700000000', licenseNumber:'DL1', email:'', licenseClass:'', licenseExpiry:'', emergencyContact:'', status:'active' }, saving:false, identityCheckVersion:{current:0}, saveAttemptVersion:{current:0}, api:{get:async()=>({data:{available:true}})}, driverId:undefined, isEditMode:false, driverRepository:{create}, photoUri:null, setSaving:()=>{}, setUploadingPhoto:()=>{}, setErrors:fn=>{ errors=typeof fn==='function'?fn(errors):fn; }, Alert:{alert:()=>{}}, resetForm:()=>{}, module:{exports:{}} };
 vm.runInNewContext(ts.transpileModule(functions.join('\n')+'\nmodule.exports = { handleSave };',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,context);
 return {save:context.module.exports.handleSave,form:context.form,errors:()=>errors,source};
}
test('Create retries the server with corrected identity after a mismatch',async()=>{
 const sent=[]; const h=harness(async body=>{sent.push(body); if(body.surname==='Wrong') throw {code:'IPRS_IDENTITY_MISMATCH'}; return {id:'D001'};});
 await h.save(); assert.ok(h.errors().nationalId); h.form.surname='Omondi'; await h.save();
 assert.equal(sent.length,2); assert.equal(sent[1].surname,'Omondi'); assert.equal(h.errors().nationalId,undefined);
});
test('Create can retry an unavailable provider and does not check IPRS on blur',async()=>{
 let calls=0;const h=harness(async()=>{if(++calls===1) throw {code:'IPRS_SESSION_FAILED'};return {id:'D001'};});
 await h.save();await h.save();assert.equal(calls,2);assert.doesNotMatch(h.source,/onBlur=|api\.post.*verify-identity/);
});

test('driver onboarding accepts an empty optional driving licence', async () => {
 const sent = [];
 const h = harness(async body => { sent.push(body); return { id: 'D002' }; });
 h.form.licenseNumber = '';
 await h.save();
 assert.equal(sent.length, 1);
 assert.equal(sent[0].licenseNumber, '');
 assert.equal(h.errors().licenseNumber, undefined);
});
