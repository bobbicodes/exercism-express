(require '[babashka.fs :as fs]
         '[clojure.string :as str]
         '[cheshire.core :as json])

(def practice-exercises
  (map #(subs (str %) 19)
       (fs/list-dir "exercises\\practice")))

(def src-all
  (for [slug practice-exercises]
    (let [filename (str/replace slug "-" "_")
          f (fs/file "exercises\\practice" slug "src" (str filename ".clj"))]
      (slurp f))))

(def exercises
  (map #(subs (str/replace % ".clj" "") 15)
       (fs/list-dir "exercise_tests")))

(def test-all
  (for [e exercises]
    (let [f (fs/file "exercise_tests" (str e ".clj"))]
      (slurp f))))

(comment
  (spit "exercises.json" 
        (json/generate-string
         (zipmap practice-exercises src-all) 
         {:pretty true}))
  (spit "tests.json"
        (json/generate-string
         (zipmap exercises test-all)
         {:pretty true}))
  )
