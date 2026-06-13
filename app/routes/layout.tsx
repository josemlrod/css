import { Link, Outlet } from 'react-router';

import logo from '../../public/logo.png';

export default function Layout() {
  return (
    <div>
      <header className='border-black border-b-2 fixed top-0 w-full bg-white z-50'>
        <div className='absolute w-full top-0 bg-secondary h-6 -z-10' />
        <div className='mx-auto max-w-[1980px] px-4 md:px-8 flex items-center'>
          <img
            alt='cinematic sites of savannah logo'
            className='h-[150px] w-[172px] pb-2'
            src={logo}
          />

          <div className='flex justify-center w-full'>
            <ul className='flex gap-6'>
              <Link
                className='font-semibold text-2xl uppercase text-primary'
                to='https://cinematicsitesofsavannah.com/'
              >
                Home
              </Link>
              <Link
                className='font-semibold text-2xl uppercase text-primary'
                to='https://cinematicsitesofsavannah.com/savannah-movie-tours/'
              >
                Tours
              </Link>
              <Link
                className='font-semibold text-2xl uppercase text-primary'
                to='https://cinematicsitesofsavannah.com/what-to-expect/'
              >
                What to expect
              </Link>
              <Link
                className='font-semibold text-2xl uppercase text-primary'
                to='https://cinematicsitesofsavannah.com/about/'
              >
                About
              </Link>
              <Link
                className='font-semibold text-2xl uppercase text-primary'
                to=''
              >
                Our Crew
              </Link>
              <Link
                className='font-semibold text-2xl uppercase text-primary'
                to='https://cinematicsitesofsavannah.com/faqs/'
              >
                Faqs
              </Link>
            </ul>
          </div>
        </div>
      </header>

      <div className='pt-[146px]'>
        <Outlet />
      </div>
    </div>
  );
}
