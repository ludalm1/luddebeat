class audioProcessor extends AudioWorkletProcessor {
	constructor(...args) {
		super(...args);
		this.audioSample = 0;
		this.byteSample = 0;
		this.errorDisplayed = true;
		this.func = null;
		this.getValues = (_s) => NaN;
		this.getValuesVisualizer = (_s) => 0;
		this.lastValues = [0,0,0];
		this.isPlaying = false;
		this.playbackSpeed = 1;
		this.divisorStorage = 0;
		this.lastTime = -1;
		this.mode = 'Bytebeat';
		this.outValue = [0, 0];
		this.sampleRate = 8000;
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
		for (let i = 0; i < 26; ++i) {
			delete globalThis[String.fromCharCode(65 + i)];
			delete globalThis[String.fromCharCode(97 + i)];
		}
		// Delete global variables
		for (const name in globalThis) {
			if (Object.prototype.hasOwnProperty.call(globalThis, name)) {
				delete globalThis[name];
			}
		}
	}
	static freezeGlobals() {
		Object.getOwnPropertyNames(globalThis).forEach(name => {
			const prop = globalThis[name];
			const type = typeof prop;
			if ((type === 'object' || type === 'function') && name !== 'globalThis') {
				Object.freeze(prop);
			}
			if (type === 'function' && Object.prototype.hasOwnProperty.call(prop, 'prototype')) {
				Object.freeze(prop.prototype);
			}
			Object.defineProperty(globalThis, name, { writable: false, configurable: false });
		});
	}
	static getErrorMessage(err, time) {
		const when = time === null ? 'compilation' : 't=' + time;
		if (!(err instanceof Error)) {
			return `${when} thrown: ${typeof err === 'string' ? err : JSON.stringify(err)}`;
		}
		const { message, lineNumber, columnNumber } = err;
		return `${when} error${typeof lineNumber === 'number' && typeof columnNumber === 'number' ?
			` (at line ${lineNumber - 3}, character ${+columnNumber})` : ''}: ${typeof message === 'string' ? message : JSON.stringify(message)}`;
	}
	handleVisualizerPixels(a) {
		let b = Array.isArray(a) ? a.slice() : a;
		if (Array.isArray(b)) {
			if (b.length == 2) b = [b[1], b[0], b[1]];
			if (b.length > 2) b = [b[0], b[1], b[2]];
			else if (b.length == 1) b = [b[0], b[0], b[0]];
			else if (b.length == 0) b = [NaN, NaN, NaN];
		} else {
			b = [b, b, b];
		}
		for (let ch = 0; ch < 3; ch++) {
			try {
				b[ch] = +b[ch];
			} catch {
				b[ch] = NaN;
			}
			if (!isNaN(b[ch]))
				b[ch] = Math.floor(this.getValuesVisualizer(b[ch], ch))&255;
		}
		return b;
	}
	handleAudioSamples(a) {
		let b = Array.isArray(a) ? a.slice() : a;
		let triples = false;
		let c = [];
		if (Array.isArray(b)) {
			if (b.length == 2) b = [b[0], b[1]];
			if (b.length > 2) { b = [b[0], b[1], b[2]]; triples = true; }
			else if (b.length == 1) b = [b[0], b[0]];
			else if (b.length == 0) b = [NaN, NaN];
		} else {
			b = [b, b];
		}
		for (let ch = 0; ch < (2 + +triples); ch++) {
			try {
				b[ch] = +b[ch];
			} catch {
				b[ch] = NaN;
			}
			if (!isNaN(b[ch]))
				this.lastValues[ch] = b[ch] = this.getValues(b[ch], ch);
			else b[ch] = this.lastValues[ch];
		}
		if (triples)
			c = [b[0] * (2 / 3) + b[1] / 3, b[2] * (2 / 3) + b[1] / 3];
		else c = [b[0], b[1]];
		this.outValue = c;
	}
	process(_inputs, [chData], _parameters) {
		const chDataLen = chData[0].length;
		const isDiagram = this.DMode === 'Diagram'
		if (!chDataLen || !this.isPlaying) {
			return true;
		}
		let time = this.sampleRatio * this.audioSample;
		let divisor = this.sampleDivisor;
		let { byteSample } = this;
		const drawBuffer = [];
		for (let i = 0; i < chDataLen; ++i) {
			time += this.sampleRatio;
			const currentTime = Math.floor(time);
			if (this.lastTime !== currentTime) {
				let funcValue;
				const currentSample = Math.floor(byteSample);
				const DivisorMet = (((currentTime % divisor) + divisor) % divisor) == 0
				try {
					if(this.mode === 'Funcbeat') {
						funcValue = this.func(currentSample / this.sampleRate, this.sampleRate);
					} else {
						funcValue = this.func(currentSample);
					}
					if (!DivisorMet) funcValue = this.divisorStorage;
					else this.divisorStorage = funcValue;
				} catch (err) {
					if (this.errorDisplayed) {
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
				let hasValue = false;
				this.handleAudioSamples(funcValue, [hasValue]);
				let visualizerValues = this.handleVisualizerPixels(funcValue);
				drawBuffer.push({ t: currentSample, value: [...visualizerValues] });
				byteSample += currentTime - this.lastTime;
				this.lastTime = currentTime;
			}
			chData[0][i] = this.outValue[0];
			chData[1][i] = this.outValue[1];
		}
		if (Math.abs(byteSample) > Number.MAX_SAFE_INTEGER) {
			this.resetTime();
			return true;
		}
		this.audioSample += chDataLen;
		let isSend = false;
		const data = {};
		if (byteSample !== this.byteSample) {
			isSend = true;
			data.byteSample = this.byteSample = byteSample;
		}
		if (drawBuffer.length) {
			isSend = true;
			data.drawBuffer = drawBuffer;
		}
		if (isSend) {
			this.sendData(data);
		}
		return true;
	}
	receiveData(data) {
		if (data.byteSample !== undefined) {
			this.byteSample = +data.byteSample || 0;
			this.resetValues();
		}
		if (data.errorDisplayed === true) {
			this.errorDisplayed = true;
		}
		if (data.isPlaying !== undefined) {
			this.isPlaying = data.isPlaying;
		}
		if (data.playbackSpeed !== undefined) {
			const sampleRatio = this.sampleRatio / this.playbackSpeed;
			this.playbackSpeed = data.playbackSpeed;
			this.setSampleRatio(sampleRatio);
		}
		if (data.mode !== undefined) {
			this.mode = data.mode;
			switch (data.mode) {
				case 'Bytebeat':
					this.getValues = (funcValue) => (funcValue & 255) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => (funcValue & 255);
					break;
				case 'Signed Bytebeat':
					this.getValues = (funcValue) =>
						((funcValue + 128) & 255) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => (funcValue + 128 & 255);
					break;
				case 'Floatbeat':
				case 'Funcbeat':
					this.getValues = (funcValue) => {
						return Math.max(Math.min(funcValue, 1), -1);
					};
					this.getValuesVisualizer = (funcValue) => (Math.max(Math.min(funcValue, 1), -1) * 127.5 + 128);
					break;
				case '-2Func2beat':
					this.getValues = (funcValue) => {
						return Math.max(Math.min(funcValue, 2), -2);
					};
					this.getValuesVisualizer = (funcValue) => (Math.max(Math.min(funcValue, 1), -1) * 127.5 + 128);
					break;
				case 'Bitbeat':
					this.getValues = (funcValue) => ((funcValue & 1) - 0.5);
					this.getValuesVisualizer = (funcValue) => (funcValue & 1 ? 192 : 64);
					break;
				case '2048':
					this.getValues = (funcValue) => {
						return (funcValue & 2047) / 1020 - 1
					};
					this.getValuesVisualizer = (funcValue) => (Math.floor(funcValue / 8) & 255);
					break;
				case 'logmode':
					this.getValues = (funcValue) => ((Math.log2(funcValue) * 32) & 255) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => ((Math.log2(funcValue) * 32) & 255);
					break;
				case 'logHack':
					this.getValues = (funcValue) => {
						const neg = (funcValue < 0) ? -32 : 32;
						return ((Math.log2(Math.abs(funcValue)) * neg) & 255) / 127.5 - 1;
					};
					this.getValuesVisualizer = (funcValue) => (Math.log2(Math.abs(funcValue)) * ((funcValue < 0) ? -32 : 32)) & 255;
					break;
				case 'logHack2':
					this.getValues = (funcValue) => {
						const neg = funcValue < 0
						return funcValue == 0 ? 0 : ((((Math.log2(Math.abs(funcValue)) * (neg ? -16 : 16)) + (neg ? -127 : 128)) & 255) / 127.5 - 1);
					};
					this.getValuesVisualizer = (funcValue) => {
						const neg = funcValue < 0
						return funcValue == 0 ? 128 : (((Math.log2(Math.abs(funcValue)) * (neg ? -16 : 16)) + (neg ? -127 : 128)) & 255);
					};
					break;
				case 'sinmode':
					this.getValues = (funcValue) => ((Math.sin(funcValue) * 32)) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => (((Math.sin(funcValue) * 128) & 255) + 127);
					break;
				case 'tanmode':
					this.getValues = (funcValue) => ((Math.tan(funcValue) * 32) & 255) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => (((Math.tan(funcValue) * 128) & 255) + 127);
					break;
				case 'tanmodenew':
					this.getValues = (funcValue) => ((Math.tan(funcValue) * 32)) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => (((Math.tan(funcValue) * 128) & 255) + 127);
					break;
				case 'cosmode':
					this.getValues = (funcValue) => ((Math.cos(funcValue) * 32)) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => (((Math.cos(funcValue) * 128) & 255) + 127);
					break;
				case 'absmode':
					this.getValues = (funcValue) => ((Math.abs(funcValue) * 32) & 255) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => ((Math.abs(funcValue) * 32) & 255);
					break;
				case 'cbrtmode':
					this.getValues = (funcValue) => ((Math.cbrt(funcValue) * 32) & 255) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => (((Math.cbrt(funcValue) * 128) & 255) + 127);
					break;
				case 'sinhmode':
					this.getValues = (funcValue) => ((Math.sinh(funcValue) * 32) & 255) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => (((Math.sinh(funcValue) * 128) & 255) + 127);
					break;
				case 'asinmode':
					this.getValues = (funcValue) => ((Math.asin(funcValue) * 32) & 255) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => (((Math.asin(funcValue) * 128) & 255) + 127);
					break;
				case 'coshmode':
					this.getValues = (funcValue) => ((Math.cosh(funcValue) * 32) & 255) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => (((Math.cosh(funcValue) * 128) & 255) + 127);
					break;
				case 'tanhmode':
					this.getValues = (funcValue) => ((Math.tanh(funcValue) * 32) & 255) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => (((Math.tanh(funcValue) * 128) & 255) + 127);
					break;
				case 'tanhmodenew':
					this.getValues = (funcValue) => ((Math.tanh(funcValue) * 32)) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => (((Math.tanh(funcValue) * 128) & 255) + 127);
					break;
				case 'acosmode':
					this.getValues = (funcValue) => ((Math.acos(funcValue) * 32) & 255) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => (((Math.acos(funcValue) * 128) & 255) + 127);
					break;
				case 'atanmode':
					this.getValues = (funcValue) => ((Math.atan(funcValue) * 32) & 255) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => (((Math.atan(funcValue) * 128) & 255) + 127);
					break;
				case 'atanmodenew':
					this.getValues = (funcValue) => ((Math.atan(funcValue) * 32)) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => (((Math.atan(funcValue) * 128) & 255) + 127);
					break;
				case 'log10mode':
					this.getValues = (funcValue) => ((Math.log10(funcValue) * 32) & 255) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => ((Math.log10(funcValue) * 32) & 255);
					break;
				case 'sqrtmode':
					this.getValues = (funcValue) => ((Math.sqrt(funcValue) * 32) & 255) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => ((Math.sqrt(funcValue) * 32) & 255);
					break;
				case 'sinfmode':
					this.getValues = (funcValue) => ((Math.sin(funcValue * Math.PI / 128) * 32)) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => (((Math.sin(funcValue / (128 / Math.PI) + 0.01) * 128) & 255) + 127);
					break;
				case 'tanfmode':
					this.getValues = (funcValue) => ((Math.tan(funcValue * Math.PI / 128)) & 255) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => (((Math.tan(funcValue / (128 / Math.PI) + 0.01) * 128) & 255) + 127);
					break;
				case 'cosfmode':
					this.getValues = (funcValue) => ((Math.cos(funcValue * Math.PI / 128) * 32)) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => (((Math.cos(funcValue / (128 / Math.PI) + 0.01) * 128) & 255) + 127);
					break;
				case 'sinmodeold':
					this.getValues = (funcValue) => ((Math.sin(funcValue) * 32) & 255) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => ((Math.sin(funcValue) * 32) & 255);
					break;
				case 'cosmodeold':
					this.getValues = (funcValue) => ((Math.cos(funcValue) * 32) & 255) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => ((Math.cos(funcValue) * 32) & 255);
					break;
				case 'asinmodeold':
					this.getValues = (funcValue) => ((Math.asin(funcValue) * 32) & 255) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => ((Math.asin(funcValue) * 32) & 255);
					break;
				case 'acosmodeold':
					this.getValues = (funcValue) => ((Math.acos(funcValue) * 32) & 255) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => ((Math.acos(funcValue) * 32) & 255);
					break;
				case 'sinhmodeold':
					this.getValues = (funcValue) => ((Math.sinh(funcValue) * 32) & 255) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => ((Math.sinh(funcValue) * 32) & 255);
					break;
				case 'coshmodeold':
					this.getValues = (funcValue) => ((Math.cosh(funcValue) * 32) & 255) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => ((Math.cosh(funcValue) * 32) & 255);
					break;
				case '4080':
					this.getValues = (funcValue) => {
						return (funcValue & 4079) / 2040 - 1
					};
					this.getValuesVisualizer = (funcValue) => (Math.floor(funcValue / 16) & 255);
					break;
				case '8160':
					this.getValues = (funcValue) => {
						return (funcValue & 8159) / 4080 - 1
					};
					this.getValuesVisualizer = (funcValue) => (Math.floor(funcValue / 32) & 255);
					break;
				case 'doublebeat':
					this.getValues = (funcValue) => {
						return Math.max(Math.min(funcValue, 255), -255);
					};
					this.getValuesVisualizer = (funcValue) => (Math.max(Math.min(funcValue, 255), -255) * 127.5 + 128);
					break;
				case 'nolimit':
					this.getValues = (funcValue) => (funcValue) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => (funcValue);
					break;
				case 'floatbeat2insteadof1':
					this.getValues = (funcValue) => {
						return Math.max(Math.min(funcValue, 2), -2);
					};
					this.getValuesVisualizer = (funcValue) => (Math.max(Math.min(funcValue, 2), -2) * 127.5 + 128);
					break;
				case 'signednolimit':
					this.getValues = (funcValue) => (funcValue + 128) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => (funcValue + 128);
					break;
				case 'Byte&beat>>12':
					this.getValues = (funcValue) => (funcValue & funcValue >> 12 & 255) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => (funcValue & funcValue >> 12 & 255);
					break;
				case 't/256*(Byte&beat>>12)':
					this.getValues = (funcValue) => (x / 256 * (funcValue ^ funcValue >> 12) & 255) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => (funcValue & funcValue >> 12 & 255);
					break;
				case 'SignedByte&beat>>12':
					this.getValues = (funcValue) => ((funcValue & funcValue >> 12 + 128) & 255) / 127.5 - 1;
					this.getValuesVisualizer = (funcValue) => (funcValue & funcValue >> 12 + 128);
					break;

				default: this.getValues = (_funcValue) => NaN;
					this.getValues = (_funcValue) => 0;
			}
		}
		if (data.setFunction !== undefined) {
			this.setFunction(data.setFunction);
		}
		if (data.resetTime === true) {
			this.resetTime();
		}
		if(data.sampleRate !== undefined) {
			this.sampleRate = data.sampleRate;
		}
		if (data.sampleRatio !== undefined) {
			this.setSampleRatio(data.sampleRatio);
		}
		if (data.divisor !== undefined) {
			this.sampleDivisor/*PRO*/ = data.divisor;
		}
		if (data.DMode !== undefined) {
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
		this.lastTime = -1;
		this.outValue = [0, 0];
	}
	setFunction(codeText) {
		const chyx = {
			/*bit*/        "bitC": function (x, y, z) { return x & y ? z : 0 },
			/*bit reverse*/"br": function (x, size = 8) {
				if (size > 32) { throw new Error("br() Size cannot be greater than 32") } else {
					let result = 0;
					for (let idx = 0; idx < (size - 0); idx++) {
						result += chyx.bitC(x, 2 ** idx, 2 ** (size - (idx + 1)))
					}
					return result
				}
			},
			/*sin that loops every 128 "steps", instead of every pi steps*/"sinf": function (x) { return Math.sin(x / (128 / Math.PI)) },
			/*cos that loops every 128 "steps", instead of every pi steps*/"cosf": function (x) { return Math.cos(x / (128 / Math.PI)) },
			/*tan that loops every 128 "steps", instead of every pi steps*/"tanf": function (x) { return Math.tan(x / (128 / Math.PI)) },
			/*converts t into a string composed of it's bits, regex's that*/"regG": function (t, X) { return X.test(t.toString(2)) }
			/*corrupt sound"crpt": function(x,y=8) {return chyx.br(chyx.br(x,y)+t,y)^chyx.br(t,y)},
			decorrupt sound"decrpt": function(x,y=8) {return chyx.br(chyx.br(x^chyx.br(t,y),y)-t,y)},*/
		}
		// Create shortened Math functions
		const params = Object.getOwnPropertyNames(Math);
		const values = params.map(k => Math[k]);
		const chyxNames = Object.getOwnPropertyNames(chyx);
		const chyxFuncs = chyxNames.map(k => chyx[k]);
		params.push('int', 'window', ...chyxNames);
		values.push(Math.floor, globalThis, ...chyxFuncs);
		audioProcessor.deleteGlobals();
		// Bytebeat code testing
		let isCompiled = false;
		const oldFunc = this.func;
		try {
			if(this.mode === 'Funcbeat') {
				this.func = new Function(...params, codeText).bind(globalThis, ...values);
			} else {
				// Optimize code like eval(unescape(escape`XXXX`.replace(/u(..)/g,"$1%")))
				codeText = codeText.trim().replace(
					/^eval\(unescape\(escape(?:`|\('|\("|\(`)(.*?)(?:`|'\)|"\)|`\)).replace\(\/u\(\.\.\)\/g,["'`]\$1%["'`]\)\)\)$/,
					(match, m1) => unescape(escape(m1).replace(/u(..)/g, '$1%')));
				this.func = new Function(...params, 't', `return 0,\n${ codeText || 0 };`)
					.bind(globalThis, ...values);
			}
			isCompiled = true;
			if(this.mode === 'Funcbeat') {
				this.func = this.func();
			}
			this.func(0);
		} catch (err) {
			if (!isCompiled) {
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
