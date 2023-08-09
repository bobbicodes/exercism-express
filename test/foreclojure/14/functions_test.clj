(deftest functions-test
  (is (= n ((fn add-five [x] (+ x 5)) 3)))
  (is (= n ((fn [x] (+ x 5)) 3)))
  (is (= n (#(+ % 5) 3)))
  (is (= n ((partial + 5) 3))))