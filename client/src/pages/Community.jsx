import React, { useEffect, useState } from 'react'
import Loading from './Loading'
import { useAppContext } from '../context/AppContext'
import toast from 'react-hot-toast'

const Community = () => {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const { axios } = useAppContext()

  const fetchImages = async () => {
    try {
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
  }

  useEffect(() => {
    fetchImages()
  }, [])

  if (loading) return <Loading />

  return (
    <div className="
      w-full h-full overflow-y-auto
      px-6 pt-10 md:px-10 xl:px-16
      bg-[#0d1117]
      text-gray-200
    ">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Community Gallery
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Images generated and shared by the community
        </p>
      </div>

      {/* Grid */}
      {images.length > 0 ? (
        <div className="
          grid gap-6
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
                bg-[#161b22]
                border border-[#30363d]
                rounded-md
                overflow-hidden
                hover:-translate-y-0.5
                hover:shadow-lg
                transition-all duration-200
              "
            >
              <img
                src={item.imageUrl}
                alt="generated"
                className="
                  w-full h-48 object-cover
                  group-hover:scale-105
                  transition-transform duration-300
                "
              />

              {/* Footer */}
              <div className="
                absolute bottom-0 left-0 right-0
                px-3 py-2
                bg-gradient-to-t
                from-black/70 to-transparent
                opacity-0 group-hover:opacity-100
                transition
              ">
                <p className="text-xs text-gray-200">
                  by <span className="text-[#7aa2f7]">{item.userName}</span>
                </p>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="mt-20 text-center text-gray-500">
          <p>No community images yet.</p>
          <p className="text-xs mt-1">
            Generated images will appear here when published.
          </p>
        </div>
      )}
    </div>
  )
}

export default Community
