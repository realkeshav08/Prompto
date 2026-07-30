import React, { useCallback, useEffect, useState } from 'react'
import Skeleton from '../components/Skeleton'
import { useAppContext } from '../context'
import toast from 'react-hot-toast'
import { assets } from '../assets/assets'

/* ============================================================
   COMMUNITY GALLERY

   Two views sharing one grid:
     • Showcase  — every creation the community has featured (public).
     • My Uploads — only the signed-in user's featured creations, each with a
                    control to remove it from the community (e.g. an accidental
                    "feature in community collection" tick). Removing an item
                    only revokes its public visibility; the image stays in the
                    user's own chat history.
   ============================================================ */

const Community = () => {
  const { axios } = useAppContext()

  const [view, setView] = useState('showcase') // 'showcase' | 'mine'
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [removingUrl, setRemovingUrl] = useState(null)

  // Load the asset list for the active view. The endpoint differs per view but
  // both return the same `{ images: [...] }` shape, so the grid stays uniform.
  const fetchImages = useCallback(async () => {
    const endpoint = view === 'mine' ? '/api/user/my-published' : '/api/user/published-images'
    try {
      setLoading(true)
      const { data } = await axios.get(endpoint)
      if (data.success) {
        setImages(data.images)
      } else {
        toast.error(data.message)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message)
    } finally {
      setLoading(false)
    }
  }, [axios, view])

  // Defer one tick so the initial setLoading() isn't a synchronous setState
  // inside the effect body (cascading-render lint rule / React guidance).
  useEffect(() => {
    const t = setTimeout(fetchImages, 0)
    return () => clearTimeout(t)
  }, [fetchImages])

  // Pull one of the user's own creations back out of the community gallery.
  const removeFromCommunity = async (item) => {
    if (removingUrl) return
    if (!window.confirm('Remove this creation from the community? It stays in your chat history.')) return

    setRemovingUrl(item.url)
    try {
      const { data } = await axios.post('/api/user/unpublish', {
        chatId: item.chatId,
        url: item.url,
      })
      if (data.success) {
        // Optimistically drop it from the grid — no need to refetch.
        setImages(prev => prev.filter(i => !(i.chatId === item.chatId && i.url === item.url)))
        toast.success('Removed from community')
      } else {
        toast.error(data.message)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message)
    } finally {
      setRemovingUrl(null)
    }
  }

  const isMine = view === 'mine'

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
      <div className="mb-10 animate-fade-in text-center md:text-left">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4 leading-tight">
          Visual <span className="text-gradient">Showcase</span>
        </h1>
        <p className="text-lg text-muted/80 max-w-2xl font-semibold leading-relaxed">
          A curated gallery of creations shared by the Prompto community. Discover, learn, and draw inspiration.
        </p>
      </div>

      {/* View switch: public showcase vs. the user's own uploads */}
      <div className="flex items-center gap-2 mb-10">
        {[
          { id: 'showcase', label: 'Showcase' },
          { id: 'mine', label: 'My Uploads' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
              view === t.id
                ? 'bg-accent text-white shadow-sm'
                : 'bg-accent-soft/40 text-muted hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton variant="content" />
      ) : images.length > 0 ? (
        <div className="
          grid gap-8
          grid-cols-1
          sm:grid-cols-2
          md:grid-cols-3
          xl:grid-cols-4
        ">
          {images.map((item, idx) => (
            <div
              key={`${item.chatId || ''}-${item.url}-${idx}`}
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
              {/* Media opens full-size in a new tab */}
              <a href={item.url} target="_blank" rel="noreferrer" className="block">
                <div className="aspect-[4/3] overflow-hidden relative">
                  {item.isVideo ? (
                    <video
                      src={item.url}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="
                        w-full h-full object-cover
                        group-hover:scale-110
                        transition-transform duration-700 ease-out
                      "
                    />
                  ) : (
                    <img
                      src={item.url}
                      alt="community creation"
                      className="
                        w-full h-full object-cover
                        group-hover:scale-110
                        transition-transform duration-700 ease-out
                      "
                    />
                  )}

                  {/* Type Badge */}
                  <div className="absolute top-4 right-4 z-10">
                    <div className="px-2.5 py-1 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 text-[8px] font-black uppercase tracking-widest text-white shadow-xl">
                      {item.isVideo ? 'Video' : 'Image'}
                    </div>
                  </div>

                  {/* Author overlay — only meaningful on the public showcase */}
                  {!isMine && (
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
                          <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold text-white uppercase">
                            {item.userName ? item.userName.charAt(0) : '?'}
                          </div>
                          <p className="text-sm font-bold text-white tracking-tight">{item.userName || 'Anonymous'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </a>

              {/* Remove control — only on the user's own uploads */}
              {isMine && (
                <button
                  onClick={() => removeFromCommunity(item)}
                  disabled={removingUrl === item.url}
                  className="
                    absolute top-3 left-3 z-20
                    flex items-center gap-1.5
                    px-3 py-1.5 rounded-xl
                    text-[10px] font-black uppercase tracking-wider
                    text-white bg-red-500/80 hover:bg-red-500
                    backdrop-blur-md shadow-xl
                    disabled:opacity-50
                    transition-all
                  "
                  title="Remove from community"
                >
                  {removingUrl === item.url ? 'Removing…' : '🗑 Remove'}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-24 text-center animate-fade-in">
          <div className="w-16 h-16 bg-accent-soft border border-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
            <img src={assets.gallery_icon} className="w-6 invert dark:invert-0 opacity-20" alt="gallery" />
          </div>
          <h2 className="text-2xl font-bold mb-2">
            {isMine ? "You haven't shared anything yet" : 'The gallery is quiet'}
          </h2>
          <p className="text-muted font-medium">
            {isMine
              ? 'Tick "Feature in community collection" when you draw to share a creation here.'
              : 'Be the first to publish a creation to the community.'}
          </p>
        </div>
      )}
    </div>
  )
}

export default Community
