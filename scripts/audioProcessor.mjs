class audioProcessor extends AudioWorkletProcessor {
	constructor(...args) {
		super(...args);
		this.audioSample = 0;
		this.byteSample = 0;
		this.errorDisplayed = true;
		this.func = null;
		this.getValues = null;
		this.isPlaying = false;
		this.playbackSpeed = 1;
		this.lastByteValue = [null, null];
		this.lastFuncValue = [null, null];
		this.divisorStorage = [null, null];
		this.lastTime = -1;
		this.outValue = [0, 0];
		this.sampleRatio = 1;
		this.sampleDivisor/*PRO*/ = 1;
		this.DMode = 'Bytebeat';
		Object.seal(this);
		audioProcessor.deleteGlobals();
		audioProcessor.freezeGlobals();
		this.port.addEventListener('message', e => this.receiveData(e.data));
		this.port.start();
	}
	static deleteGlobals() {
		// Delete single letter variables to prevent persistent variable errors (covers a good enough range)
		for(let i = 0; i < 26; ++i) {
			delete globalThis[String.fromCharCode(65 + i)];
			delete globalThis[String.fromCharCode(97 + i)];
		}
		// Delete global variables
		for(const name in globalThis) {
			if(Object.prototype.hasOwnProperty.call(globalThis, name)) {
				delete globalThis[name];
			}
		}
	}
	static freezeGlobals() {
		Object.getOwnPropertyNames(globalThis).forEach(name => {
			const prop = globalThis[name];
			const type = typeof prop;
			if((type === 'object' || type === 'function') && name !== 'globalThis') {
				Object.freeze(prop);
			}
			if(type === 'function' && Object.prototype.hasOwnProperty.call(prop, 'prototype')) {
				Object.freeze(prop.prototype);
			}
			Object.defineProperty(globalThis, name, { writable: false, configurable: false });
		});
	}
	static getErrorMessage(err, time) {
		const when = time === null ? 'compilation' : 't=' + time;
		if(!(err instanceof Error)) {
			return `${ when } thrown: ${ typeof err === 'string' ? err : JSON.stringify(err) }`;
		}
		const { message, lineNumber, columnNumber } = err;
		return `${ when } error: ${ typeof message === 'string' ? message : JSON.stringify(message) }${
			typeof lineNumber === 'number' && typeof columnNumber === 'number' ?
				` (at line ${ lineNumber - 3 }, character ${ +columnNumber })` : '' }`;
	}
	process(inputs, [chData], parameters) {
		const chDataLen = chData[0].length;
		const isDiagram = this.DMode === 'Diagram'
		if(!chDataLen || !this.isPlaying) {
			return true;
		}
		let time = this.sampleRatio * this.audioSample;
		let divisor = this.sampleDivisor;
		let { byteSample } = this;
		const drawBuffer = [];
		for(let i = 0; i < chDataLen; ++i) {
			time += this.sampleRatio;
			const currentTime = Math.floor(time);
			if(this.lastTime !== currentTime) {
				let funcValue;
				const currentSample = Math.floor(byteSample);
				const DivisorMet = (((currentTime%divisor)+divisor)%divisor)==0
				try {
					funcValue = this.func(currentSample);
				} catch(err) {
					if(this.errorDisplayed) {
						this.errorDisplayed = false;
						this.sendData({
							error: {
								message: audioProcessor.getErrorMessage(err, currentSample),
								isRuntime: true
							}
						});
					}
					funcValue = NaN;
				}
				funcValue = Array.isArray(funcValue) ? [funcValue[0], funcValue[1]] : [funcValue, funcValue];
				let hasValue = false;
				let ch = 2;
				while(ch--) {
					try {
						funcValue[ch] = this.divisorStorage[ch] = DivisorMet?+funcValue[ch]:+this.divisorStorage[ch];
					} catch(err) {
						funcValue[ch] = NaN;
					}
					if(funcValue[ch] === this.lastFuncValue[ch] &&!isDiagram) {
						continue;
					} else if(!isNaN(funcValue[ch])) {
						this.outValue[ch] = this.getValues(funcValue[ch], ch);
						hasValue = true;
					} else if(!isNaN(this.lastFuncValue[ch])||isDiagram) {
						this.lastByteValue[ch] = NaN;
						hasValue = true;
					}
				}
				if(hasValue) {
					drawBuffer.push({ t: currentSample, value: [...this.lastByteValue] });
				}
				byteSample += currentTime - this.lastTime;
				this.lastFuncValue = funcValue;
				this.lastTime = currentTime;
			}
			chData[0][i] = this.outValue[0];
			chData[1][i] = this.outValue[1];
		}
		if(Math.abs(byteSample) > Number.MAX_SAFE_INTEGER) {
			this.resetTime();
			return true;
		}
		this.audioSample += chDataLen;
		let isSend = false;
		const data = {};
		if(byteSample !== this.byteSample) {
			isSend = true;
			data.byteSample = this.byteSample = byteSample;
		}
		if(drawBuffer.length) {
			isSend = true;
			data.drawBuffer = drawBuffer;
		}
		if(isSend) {
			this.sendData(data);
		}
		return true;
	}
	receiveData(data) {
		if(data.byteSample !== undefined) {
			this.byteSample = +data.byteSample || 0;
			this.resetValues();
		}
		if(data.errorDisplayed === true) {
			this.errorDisplayed = true;
		}
		if(data.isPlaying !== undefined) {
			this.isPlaying = data.isPlaying;
		}
		if(data.playbackSpeed !== undefined) {
			const sampleRatio = this.sampleRatio / this.playbackSpeed;
			this.playbackSpeed = data.playbackSpeed;
			this.setSampleRatio(sampleRatio);
		}
		if(data.mode !== undefined) {
			switch(data.mode) {
			case 'Bytebeat':
				this.getValues = (funcValue, ch) => (this.lastByteValue[ch] = funcValue & 255) / 127.5 - 1;
				break;
			case 'Signed Bytebeat':
				this.getValues = (funcValue, ch) =>
					(this.lastByteValue[ch] = (funcValue + 128) & 255) / 127.5 - 1;
				break;
			case 'Floatbeat':
				this.getValues = (funcValue, ch) => {
					const outValue = Math.max(Math.min(funcValue, 1), -1);
					this.lastByteValue[ch] = Math.round((outValue + 1) * 127.5);
					return outValue;
				};
				break;
				case 'Bitbeat':
					this.getValues = (funcValue, ch) => {
						const outValue = (funcValue&1)-0.5;
						this.lastByteValue[ch] = funcValue&1?192:64;
						return outValue;
					};
					break;
				case '2048':
					this.getValues = (funcValue, ch) => {
						this.lastByteValue[ch] = (Math.floor(funcValue/8)&255);
						return (funcValue&2047)/1020-1
					};
					break;
				case 'logmode':
					this.getValues = (funcValue, ch) => (this.lastByteValue[ch] = (Math.log2(funcValue)*32)&255) / 127.5 - 1;
					break;
				case 'logHack':
					this.getValues = (funcValue, ch) => {
						const neg = (funcValue<0)?-32:32;
						const out = this.lastByteValue[ch] = (Math.log2(Math.abs(funcValue))*neg)&255
						return out / 127.5 - 1
					};
					break;
				case 'logHack2':
				this.getValues = (funcValue, ch) => {
					const neg = funcValue<0
					const out = this.lastByteValue[ch] = ((Math.log2(Math.abs(funcValue))*(neg?-16:16))+(neg?-127:128))&255
					return out / 127.5 - 1
				};
				break;
				case 'sinmode':
					this.getValues = (funcValue, ch) => (this.lastByteValue[ch] = (Math.sin(funcValue)*32)) / 127.5 - 1;
					break;
				case 'cosmode':
					this.getValues = (funcValue, ch) => (this.lastByteValue[ch] = (Math.cos(funcValue)*32)) / 127.5 - 1;
					break;
				case 'absmode':
					this.getValues = (funcValue, ch) => (this.lastByteValue[ch] = (Math.abs(funcValue)*32)&255) / 127.5 - 1;
					break;
				case 'cbrtmode':
					this.getValues = (funcValue, ch) => (this.lastByteValue[ch] = (Math.cbrt(funcValue)*32)&255) / 127.5 - 1;
					break;
				case 'sinhmode':
					this.getValues = (funcValue, ch) => (this.lastByteValue[ch] = (Math.sinh(funcValue)*32)) / 127.5 - 1;
					break;
				case 'coshmode':
					this.getValues = (funcValue, ch) => (this.lastByteValue[ch] = (Math.cos(funcValue)*32)) / 127.5 - 1;
					break;
				case 'asinmode':
					this.getValues = (funcValue, ch) => (this.lastByteValue[ch] = (Math.asin(funcValue)*32)) / 127.5 - 1;
					break;
				case 'acosmode':
					this.getValues = (funcValue, ch) => (this.lastByteValue[ch] = (Math.acos(funcValue)*32)) / 127.5 - 1;
					break;
				case 'log10mode':
					this.getValues = (funcValue, ch) => (this.lastByteValue[ch] = (Math.log10(funcValue)*32)&255) / 127.5 - 1;
					break;
				case 'sqrtmode':
					this.getValues = (funcValue, ch) => (this.lastByteValue[ch] = (Math.sqrt(funcValue)*32)&255) / 127.5 - 1;
					break;
		 		case 'sinfmode':
					this.getValues = (funcValue, ch) => (this.lastByteValue[ch] = (Math.sin(funcValue*Math.PI/128+0.01)*32)) / 127.5 - 1;
					break;
		 		case 'cosfmode':
					this.getValues = (funcValue, ch) => (this.lastByteValue[ch] = (Math.cos(funcValue*Math.PI/128+0.01)*32)) / 127.5 - 1;
					break;
				case 'sinmodeold':
					this.getValues = (funcValue, ch) => (this.lastByteValue[ch] = (Math.sin(funcValue)*32)&255) / 127.5 - 1;
					break;
				case 'cosmodeold':
					this.getValues = (funcValue, ch) => (this.lastByteValue[ch] = (Math.cos(funcValue)*32)&255) / 127.5 - 1;
					break;
				case 'asinmodeold':
					this.getValues = (funcValue, ch) => (this.lastByteValue[ch] = (Math.asin(funcValue)*32)&255) / 127.5 - 1;
					break;
				case 'acosmodeold':
					this.getValues = (funcValue, ch) => (this.lastByteValue[ch] = (Math.acos(funcValue)*32)&255) / 127.5 - 1;
					break;
				case 'sinhmodeold':
					this.getValues = (funcValue, ch) => (this.lastByteValue[ch] = (Math.sinh(funcValue)*32)&255) / 127.5 - 1;
					break;
				case 'coshmodeold':
					this.getValues = (funcValue, ch) => (this.lastByteValue[ch] = (Math.cosh(funcValue)*32)&255) / 127.5 - 1;
					break;

			default: this.getValues = (_funcValue, ch) => (this.lastByteValue[ch] = NaN);
			}
		}
		if(data.setFunction !== undefined) {
			this.setFunction(data.setFunction);
		}
		if(data.resetTime === true) {
			this.resetTime();
		}
		if(data.sampleRatio !== undefined) {
			this.setSampleRatio(data.sampleRatio);
		}
		if(data.divisor !== undefined) {
			this.sampleDivisor/*PRO*/ = data.divisor;
		}
		if(data.DMode !== undefined) {
			this.DMode = data.DMode;
		}
	}
	sendData(data) {
		this.port.postMessage(data);
	}
	resetTime() {
		this.byteSample = 0;
		this.resetValues();
		this.sendData({ byteSample: 0 });
	}
	resetValues() {
		this.audioSample = 0;
		this.lastByteValue = this.lastFuncValue = [null, null];
		this.lastTime = -1;
		this.outValue = [0, 0];
	}
	setFunction(codeText) {
		const chyx = {
			/*bit*/        "bitC": function(x,y,z) {return x&y?z:0},
			/*bit reverse*/"br": function(x,size=8) {
				if (size>32) {throw new Error("br() Size cannot be greater than 32")} else {
				let result = 0; 
				for(let idx=0;idx<(size-0);idx++){
					result += chyx.bitC(x,2**idx,2**(size-(idx+1)))
				}
				return result
				}
			},
			/*sin that loops every 128 "steps", instead of every pi steps*/"sinf": function(x) {return Math.sin(x/(128/Math.PI))},
			/*cos that loops every 128 "steps", instead of every pi steps*/"cosf": function(x) {return Math.cos(x/(128/Math.PI))},
			/*tan that loops every 128 "steps", instead of every pi steps*/"tanf": function(x) {return Math.tan(x/(128/Math.PI))},
			/*converts t into a string composed of it's bits, regex's that*/"regG": function(t,X){return X.test(t.toString(2))}
			/*corrupt sound"crpt": function(x,y=8) {return chyx.br(chyx.br(x,y)+t,y)^chyx.br(t,y)},
			decorrupt sound"decrpt": function(x,y=8) {return chyx.br(chyx.br(x^chyx.br(t,y),y)-t,y)},*/
			}
		// Create shortened Math functions
		const params = Object.getOwnPropertyNames(Math);
		const values = params.map(k => Math[k]);
		const chyxNames = ['bitC','br','sinf','cosf','tanf','regG']
		const chyxFuncs = [ chyx.bitC, chyx.br, chyx.sinf, chyx.cosf, chyx.tanf,chyx.regG]
		params.push('int', 'window', ...chyxNames);
		values.push(Math.floor, globalThis, ...chyxFuncs);
		audioProcessor.deleteGlobals();
		// Optimize code like eval(unescape(escape`XXXX`.replace(/u(..)/g,"$1%")))
		codeText = codeText.trim().replace(
			/^eval\(unescape\(escape(?:`|\('|\("|\(`)(.*?)(?:`|'\)|"\)|`\)).replace\(\/u\(\.\.\)\/g,["'`]\$1%["'`]\)\)\)$/,
			(_match, p1) => unescape(escape(p1).replace(/u(..)/g, '$1%')));
		// Bytebeat code testing
		let isCompiled = false;
		const oldFunc = this.func;
		try {
			this.func = new Function(...params, 't', `return 0,\n${ codeText || 0 };`)
				.bind(globalThis, ...values);
			isCompiled = true;
			this.func(0);
		} catch(err) {
			if(!isCompiled) {
				this.func = oldFunc;
			}
			this.errorDisplayed = false;
			this.sendData({
				error: {
					message: audioProcessor.getErrorMessage(err, isCompiled ? 0 : null),
					isCompiled
				},
				updateUrl: isCompiled
			});
			return;
		}
		this.errorDisplayed = false;
		this.sendData({ error: { message: '', isCompiled }, updateUrl: true });
	}
	setSampleRatio(sampleRatio) {
		const timeOffset = Math.floor(this.sampleRatio * this.audioSample) - this.lastTime;
		this.sampleRatio = sampleRatio * this.playbackSpeed;
		this.lastTime = Math.floor(this.sampleRatio * this.audioSample) - timeOffset;
	}
}

registerProcessor('audioProcessor', audioProcessor);
