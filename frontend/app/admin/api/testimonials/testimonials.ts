import api from "../base"
import axios from "axios"

export interface Testimonial {
    id: string
    name: string
    position: string
    description: string
    imageUrl?: string | null
    createdAt?: string
}

// Raw axios for file uploads (avoids cache interceptor)
const rawApi = axios.create({
    baseURL: api.defaults.baseURL,
    withCredentials: true,
})

export const uploadTestimonialImage = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append("file", file)
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null
    const { data } = await rawApi.post("/testimonial/upload-image", formData, {
        headers: {
            "Content-Type": "multipart/form-data",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    })
    return data.imageUrl
}

export const getTestimonials = async (): Promise<Testimonial[]> => {
    const response = await api.get("/testimonial", { cache: false })
    return response.data
}

export const createTestimonial = async (data: Omit<Testimonial, "id">): Promise<Testimonial> => {
    const response = await api.post("/testimonial", data)
    return response.data
}

export const updateTestimonial = async (id: string, data: Partial<Testimonial>): Promise<Testimonial> => {
    const response = await api.patch(`/testimonial/${id}`, data)
    return response.data
}

export const deleteTestimonial = async (id: string): Promise<void> => {
    await api.delete(`/testimonial/${id}`)
}
