import { Link } from 'react-router';

export default function Home() {
  return (
    <main className='h-dvh w-dvw flex justify-center items-center'>
      <div className='h-fit flex gap-2'>
        <p className='text-2xl'>Demo tour:</p>
        <Link
          className='text-2xl text-blue-400 underline'
          to='/tour/haunted-hot-spots'
        >
          here
        </Link>
      </div>
    </main>
  );
}
