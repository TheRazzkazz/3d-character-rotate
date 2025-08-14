// Suppress EXGL: gl.pixelStorei() doesn't support this parameter yet! globally
import { LogBox } from 'react-native';
import { GLView } from 'expo-gl';

LogBox.ignoreLogs([/EXGL: gl\.pixelStorei\(\) doesn't support this parameter yet!/]);

// Use 'any' to bypass type errors for prototype override
const GLViewAny = GLView as any;
const origCreateContextAsync = GLViewAny.prototype.createContextAsync;
GLViewAny.prototype.createContextAsync = async function (...args: any[]) {
  const gl: any = await origCreateContextAsync.apply(this, args);
    const origGetExtension = gl.getExtension?.bind(gl);
  gl.getExtension = (name: string) => {
    const ext = origGetExtension ? origGetExtension(name) : null;
    return ext ?? null; // convert undefined to null
  };
  const origGetParameter = gl.getParameter?.bind(gl);
  gl.getParameter = (pname: any) => {
    if (pname === undefined) return 0;
    return origGetParameter ? origGetParameter(pname) : 0;
  };
  const origPixelStorei = gl.pixelStorei.bind(gl);
  gl.pixelStorei = (pname: any, param: any) => {
    if (pname === 0x9243 || pname === 0x9241) return; // unsupported enums
    return origPixelStorei(pname, param);
  };
  return gl;
};
