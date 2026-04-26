import React, { useCallback, useEffect, useState } from 'react'
import Loading from './Loading'
import { useAppContext } from '../context/AppContext'
import toast from 'react-hot-toast'
import { assets } from '../assets/assets'

const Community = () => {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const { axios } = useAppContext()

  const fetchImages = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await axios.get('/api/user/published-images')
      if (data.success) {
        setImages(data.images)
      } else {
        toast.error(data.message)
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [axios])

  useEffect(() => {
    const t = setTimeout(fetchImages, 0)
    return () => clearTimeout(t)
  }, [fetchImages])

  if (loading) return <Loading />

  return (
    <div className="
      w-full h-full overflow-y-auto
      px-6 pt-16 md:px-12 xl:px-24 pb-20
      bg-bg relative
      text-text custom-scrollbar
    ">
      {/* Decorative background */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-accent/5 blur-[120px] rounded-full -z-10" />

      {/* Header section */}
      <div className="mb-14 animate-fade-in text-center md:text-left">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4 leading-tight">
          Visual <span className="text-gradient">Showcase</span>
        </h1>
        <p className="text-lg text-muted/80 max-w-2xl font-semibold leading-relaxed">
          A curated collection of neural concepts engineered by our global community. Discover, learn, and draw inspiration.
        </p>
      </div>

      {/* Elegant Grid */}
      {images.length > 0 ? (
        <div className="
          grid gap-8
          grid-cols-1
          sm:grid-cols-2
          md:grid-cols-3
          xl:grid-cols-4
        ">
          {images.map((item, idx) => (
            <a
              key={idx}
              href={item.imageUrl}
              target="_blank"
              rel="noreferrer"
              className="
                group relative
                glass shadow-premium
                rounded-[1.5rem]
                overflow-hidden
                hover:-translate-y-2
                transition-all duration-500
                animate-fade-in
              "
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={item.imageUrl}
                  alt="community creation"
                  className="
                    w-full h-full object-cover
                    group-hover:scale-110
                    transition-transform duration-700 ease-out
                  "
                />
              </div>

              {/* Sophisticated Overlay */}
              <div className="
                absolute inset-0
                bg-gradient-to-t
                from-black/80 via-black/20 to-transparent
                opacity-0 group-hover:opacity-100
                transition-opacity duration-300
                flex flex-col justify-end
                p-6
              ">
                <div className="translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">Created by</p>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold text-white">
                      {item.userName.charAt(0)}
                    </div>
                    <p className="text-sm font-bold text-white tracking-tight">{item.userName}</p>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="mt-32 text-center animate-fade-in">
          <div className="w-16 h-16 bg-accent-soft border border-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
            <img src={assets.gallery_icon} className="w-6 invert dark:invert-0 opacity-20" alt="gallery" />
          </div>
          <h2 className="text-2xl font-bold mb-2">The gallery is quiet</h2>
          <p className="text-muted font-medium">Be the first to publish a creation to the community.</p>
        </div>
      )}
    </div>
  )
}

export default Community
