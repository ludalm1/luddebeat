globalThis.baker = new class { //Chasyxx's bakers chasyxx.github.io/minibaker
	constructor() {
		this.in = null;
		this.temp = null;
		this.c1 = null;
		this.c2 = null;
		this.cc1 = null;
		this.cc2 = null;
		this.cmb = null;
		this.sts = null;
	}
	minibake(str){
		if (str.length&1) {
			str+= " "
		}
		str = str.replace( /, /g, ",");
		let len = Math.floor( str.length / 2 );
		let output = "";
		for(let i=0; i<len; i++){
			this.c1 = str.substring( i * 2, i * 2 + 1);
			this.c2 = str.substring( i * 2 + 1, i * 2 + 2);
			this.cc1 = this.c1.charCodeAt(0);
			this.cc2 = this.c2.charCodeAt(0);
			this.cmb = (this.cc1 << 8) | this.cc2;
			output += String.fromCharCode(this.cmb);
			//output += String.fromCodePoint(cmb);
		}
		MAT.output("eval(unescape(escape`" + output + "`.replace(/u(..)/g,\"$1%\")))",true);
	}
	debake(str) {
		let temp = null;
		str = str.replace( /, /g, ",").slice(21,str.length-27);
		let len = str.length;
		let output = "";
		for(let i=0; i<len; i++){
			temp=str.charCodeAt(i)
			this.cc1=temp>>8
			this.cc2=temp&255
			output += String.fromCharCode(this.cc1);
			output += String.fromCharCode(this.cc2);
			//output += String.fromCodePoint(cmb);
		}
		if(output != "") {
		MAT.output(output,true)
		}
	}
}

globalThis.MAT = new class { //Menus and transformations
	constructor() {
		this.currentMenu = 1;
		this.errorReason = null;
		this.isErrored = false;
		this.considerParens = true; //Console should be able to change this
		this.formatted = null;
		this.code = document.getElementById('editor-default');
		this.forceElem = document.getElementById('control-force-output');
		this.clearElem = document.getElementById('control-clear-output');
		this.startElem = document.getElementById('control-format');
		this.bakeElem = document.getElementById('control-minibake');
		this.debakeElem = document.getElementById('control-deminibake');
		this.global = false;
		this.errorText = null;
		this.oldCode = null;
	}
	changeMenu(x) {
		var oldMenu = document.getElementById(`controls${this.currentMenu}`);
		var newMenu = document.getElementById(`controls${x}`);
		oldMenu.classList.add('hidden');
		newMenu.classList.remove('hidden');
		this.currentMenu = x;
	}
	startError(reason){
		this.errorReason = reason;
		this.isErrored = true;
	}
	setCodeMirrorEditor(string){
			bytebeat.editorView.dispatch({
				changes: {
					from: 0,
					to: bytebeat.editorView.state.doc.toString().length,
					insert: string
				}
			})
	}
	output(text = this.formatted, update=false){
		if(this.global) {
		this.setCodeMirrorEditor(text)
		} else {
		this.code.value = text
		}
		this.forceElem.classList.add("hidden")
		this.startElem.classList.remove(`hidden`);
		this.clearElem.classList.add("hidden")
		try{if(update) {
			bytebeat.updateUrl() //Commit changes to the saved URL
		}}catch(err){console.error(`URL not saved (${err.message})`)}
	}
	clear(){
		this.output(this.oldCode,true)
	}
	commaFormat(){
		var initialCode;
		var temp = null;
		var parenLayerCount = 0;
		this.global = false
		try { //global testing
		var toEncode = initialCode = bytebeat.editorValue;
			this.global = true;
		} catch(err) { //local testing
			console.log(`Locally testing because ${err.message}`);
			var toEncode = initialCode = this.code.value;
		}
		var inString = false;
		var arrayLayerCount = false;
		var stringCount = 0;
			for (var i=0;i<toEncode.length;i++) {
				if (this.isErrored) {break} // error handling
				switch(toEncode[i]){
					case `,`: case `;`:
						if((parenLayerCount == 0 || !this.considerParens) && (arrayLayerCount == 0) && !inString && toencode[i+1] != `\n`) {
							temp = toEncode.slice(0,i) + `${toEncode[i]}\n` + toEncode.slice(i+1,toEncode.length)
							toencode = temp
						}
					break

					case `\``: case `'`: case `"`:
						inString = !inString
						stringCount++
					break

					case `[`: 
						if(!inString) {
							arrayLayerCount++
						}
					break

					case `]`: 
						if(!inString) {
							arrayLayerCount--
							if (arrayLayerCount<0){
								this.startError("Unbalanced arrays!")
							}
						}							
					break

					case `(`: 
						if(!inString) {
							parenLayerCount++
						}
					break

					case `)`: 
						if(!inString) {
							parenLayerCount--
							if (parenLayerCount<0){
								this.startError("Unbalanced parenthesies!")
							}
						}
					break
				}
			}
			this.formatted=toEncode;
			this.errorText=null;
			if(stringCount&1){
				console.error(this.errorText = "Error in comma-formatting: Unterminated string!")
				this.isErrored = true
			} else if(arrayLayerCount != 0) {
				console.error(this.errorText = "Error in comma-formatting: Unbalanced array!")
				this.isErrored = true
			} else if(parenLayerCount != 0) {
				console.error(this.errorText = "Error in comma-formatting: Unbalanced parenthesies!")
				this.isErrored = true
			} else if (this.isErrored) {
				console.error(this.errorText = `Error in comma-formatting: ${this.errorReason}`)
			} else {this.output(this.formatted,true)}
			if(this.isErrored){
				console.warn("This simply means the formatting may be incorrect. To force the formatted code to output use MAT.output() or click Force output")
			} else {
				console.log("Sucessfully formatted!")
				this.forceElem.classList.add('hidden');	
				this.startElem.classList.remove(`hidden`);
				this.clearElem.classList.add('hidden');			
			}
			if(this.isErrored){
				this.output(`${initialCode} \n\n// ${this.errorText} \n// This simply means the formatting may be incorrect. To force the formatted code to output, click "Force output"`,false);
				this.oldCode = initialCode;
				this.forceElem.classList.remove('hidden');
				this.startElem.classList.add(`hidden`);
				this.clearElem.classList.remove('hidden');	
			}
		this.isErrored=false
	}
	bake(){
		try { //global testing
			var toEncode = bytebeat.editorValue;
				this.global = true;
		} catch(err) { //local testing
				console.log(`Locally testing because ${err.message}`);
				var toEncode = this.code.value;
		}
		baker.minibake(toEncode)
	}
	debake(){
		try { //global testing
			var toEncode = bytebeat.editorValue;
				this.global = true;
		} catch(err) { //local testing
				console.log(`Locally testing because ${err.message}`);
				var toEncode = this.code.value;
		}
		baker.debake(toEncode)
	}
}