import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {it,expect,vi,afterEach} from 'vitest';
import {LoginPage,safeReturnTo} from './LoginPage';
import {RequireOwner} from './RequireOwner';
afterEach(()=>vi.unstubAllGlobals());
it('rejects external return targets',()=>{
  expect(safeReturnTo('https://bad.test')).toBe('/knowledge');
  expect(safeReturnTo('//bad.test')).toBe('/knowledge');
  expect(safeReturnTo('/knowledge/import')).toBe('/knowledge/import');
});
it('redirects anonymous knowledge visits to login',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({success:true,data:{authenticated:false}})})));
  render(<MemoryRouter initialEntries={['/knowledge/import']}><Routes><Route path="/knowledge/import" element={<RequireOwner><p>private content</p></RequireOwner>}/><Route path="/login" element={<p>login required</p>}/></Routes></MemoryRouter>);
  expect(await screen.findByText('login required')).toBeInTheDocument();
  expect(screen.queryByText('private content')).not.toBeInTheDocument();
});
it('shows credential errors without navigating or removing password',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,status:401,json:async()=>({success:false,error:{code:'INVALID_CREDENTIALS'}})})));
  render(<MemoryRouter><LoginPage/></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('用户名'),{target:{value:'admin'}});
  fireEvent.change(screen.getByLabelText('密码'),{target:{value:'wrong'}});
  fireEvent.click(screen.getByRole('button',{name:'登录'}));
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('用户名或密码不正确'));
});
