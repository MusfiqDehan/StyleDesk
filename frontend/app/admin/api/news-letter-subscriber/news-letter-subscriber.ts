import api from "../base"

export interface NewsLetterSubscriber {
    id: string
    email: string
    createdAt: string
}

export const getSubscribers = async (): Promise<NewsLetterSubscriber[]> => {
    const response = await api.get("/news-letter-subscriber", { cache: false })
    return response.data
}

export const createSubscriber = async (data: { email: string }): Promise<NewsLetterSubscriber> => {
    const response = await api.post("/news-letter-subscriber", data)
    return response.data
}

export const deleteSubscriber = async (id: string): Promise<void> => {
    await api.delete(`/news-letter-subscriber/${id}`)
}
