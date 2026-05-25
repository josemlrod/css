import { Outlet } from 'react-router';

import logo from '../../public/logo.png';

export default function Layout() {
  return (
    <div>
      <header className='border-black border-b-2 fixed top-0 w-full bg-white z-50'>
        <div className='absolute w-full top-0 bg-secondary h-6 -z-10' />
        <div className='mx-auto max-w-[1980px] px-4 md:px-8'>
          <img
            alt='cinematic sites of savannah logo'
            className='h-[150px] w-[172px] pb-2'
            src={logo}
          />
        </div>
      </header>

      <div className='pt-[146px]'>
        <Outlet />
      </div>
    </div>
  );
}
